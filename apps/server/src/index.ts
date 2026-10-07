import "dotenv/config";
import express from "express";
import helmet from "helmet";
import crypto from "crypto";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import {
    CORS_ORIGIN,
    DEBUG_IP_ENDPOINT,
    ENABLE_QUEUE_DASHBOARD,
    NODE_ENV,
    PORT,
    QUEUE_DASHBOARD_PASSWORD,
    QUEUE_DASHBOARD_USER,
    TRUSTED_PROXY_CIDRS,
} from "./constants/env";
import { ok } from "./utils/api/apiEnvelope";
import { notFound } from "./middleware/notFound";
import { errorHandler } from "./middleware/errorHandler";
import { visitorIdMiddleware } from "./middleware/visitorId";
import { globalLimiter } from "./config/ratelimiter";
import { extractClientIp, trustProxy } from "./utils/ratelimiter/ipExtractor";
import { cache } from "./utils/cache";
import { connectDB, closeDB, pool } from "./config/db";
import { setupBullBoard } from "./jobs/dashboard/bull-board";
import { closeWorkers } from "./worker";
import { authRoutes } from "./routes/auth.route";
import { sessionRoutes } from "./routes/session.route";
import { projectRoutes } from "./routes/project.route";
import { aiRoutes } from "./routes/ai.route";
import { liveblocksRoutes } from "./routes/liveblocks.route";

/**
 * Basic auth for the queue dashboard. Compared with a timing-safe digest comparison so the
 * credentials can't be recovered a character at a time.
 */
const queueDashboardAuth: express.RequestHandler = (req, res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, encoded] = header.split(" ");

    if (scheme === "Basic" && encoded) {
        const [user, password] = Buffer.from(encoded, "base64").toString().split(":");
        if (matchesSecret(user, QUEUE_DASHBOARD_USER) && matchesSecret(password, QUEUE_DASHBOARD_PASSWORD)) {
            return next();
        }
    }

    res.setHeader("WWW-Authenticate", 'Basic realm="Queues"');
    res.status(401).send("Authentication required");
};

// Hashing first keeps the comparison length-independent, since timingSafeEqual throws on a
// length mismatch — which would itself leak the length.
const matchesSecret = (candidate: string | undefined, expected: string): boolean => {
    const a = crypto.createHash("sha256").update(candidate ?? "").digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    return crypto.timingSafeEqual(a, b);
};

async function main() {
    // Fail at boot, not on the first request, if the database is unreachable.
    await connectDB();

    const app = express();

    /*
      BullMQ dashboard. Job payloads contain password-reset and email-verification tokens, so an
      unauthenticated dashboard is an account-takeover path. It requires an explicit opt-in AND
      credentials, and refuses to mount half-configured.
     */
    const queueDashboardEnabled = ENABLE_QUEUE_DASHBOARD === "true";
    const queueDashboardConfigured =
        Boolean(QUEUE_DASHBOARD_USER) && Boolean(QUEUE_DASHBOARD_PASSWORD);

    if (queueDashboardEnabled && !queueDashboardConfigured) {
        throw new Error(
            "ENABLE_QUEUE_DASHBOARD is true but QUEUE_DASHBOARD_USER/QUEUE_DASHBOARD_PASSWORD are not set"
        );
    }

    if (queueDashboardEnabled) {
        app.use("/admin/queues", queueDashboardAuth, setupBullBoard());
    }

    // Trust exactly the proxies the rate limiter trusts, so Express and the limiter agree on the client IP.
    app.set("trust proxy", trustProxy);

    if (NODE_ENV === "production" && !TRUSTED_PROXY_CIDRS.trim()) {
        console.warn(
            "TRUSTED_PROXY_CIDRS is empty. If this server runs behind a load balancer or reverse proxy, " +
            "every client will share that proxy's IP and one rate-limit bucket. See .env.example."
        );
    }

    // Baseline response headers. `crossOriginResourcePolicy` is relaxed because the web app is
    // served from another origin.
    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" },
            hsts: NODE_ENV === "production" ? undefined : false,
        })
    );

    const corsOrigin = CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
    app.use(cors({ origin: corsOrigin, credentials: true }));

    // Canvas snapshots are the largest bodies this API accepts (up to a few thousand nodes).
    app.use(express.json({ limit: "2mb" }));
    // `dev` is colourised and human-shaped; a deployed server's output is read by a log collector.
    app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));
    app.use(cookieParser());
    app.use(visitorIdMiddleware);
    app.use(globalLimiter);

    /*
      Shows how the rate limiter identifies the caller, to check TRUSTED_PROXY_CIDRS on a real deploy.
      Off unless DEBUG_IP_ENDPOINT=true: it echoes proxy headers and reveals which ones are trusted.
     */
    if (DEBUG_IP_ENDPOINT === "true") {
        app.get("/debug-ip", (req, res) => {
            const peer = req.socket.remoteAddress;
            res.json(ok({
                resolvedIp: extractClientIp(req),
                expressReqIp: req.ip,
                tcpPeer: peer,
                peerIsTrustedProxy: peer ? trustProxy(peer) : false,
                visitorId: req.visitorId ?? null,
            }));
        });
    }

    /*
      Reports the dependencies, not just the process: a 200 while Postgres is unreachable would keep
      a load balancer sending traffic to an instance that can't serve a request. Redis is reported but
      not fatal: the cache and rate limiter both degrade to working without it.
     */
    app.get("/health", async (_req, res) => {
        const [postgresUp, redisReady] = await Promise.all([
            pool.query("SELECT 1").then(
                () => true,
                () => false
            ),
            cache.ping(),
        ]);

        return res.status(postgresUp ? 200 : 503).json(
            ok({
                status: postgresUp ? "ok" : "degraded",
                postgres: postgresUp ? "up" : "down",
                redis: redisReady ? "up" : "down",
            })
        );
    });

    // Routes declaration.
    app.use("/auth", authRoutes);
    app.use("/session", sessionRoutes);
    app.use("/projects", projectRoutes);
    app.use("/ai", aiRoutes);
    app.use("/liveblocks", liveblocksRoutes);

    // Registered before listening, so a request can never arrive at a server whose 404 and error
    // handlers aren't mounted yet.
    app.use(notFound);
    app.use(errorHandler);

    const BACKEND_PORT = Number(PORT) || 5000;
    const server = app.listen(BACKEND_PORT, "0.0.0.0", () => {
        console.log(`Server is listening to the port: ${BACKEND_PORT}`);
        if (queueDashboardEnabled) {
            console.log(`BullMQ Dashboard available at: http://localhost:${BACKEND_PORT}/admin/queues`);
        }
    });

    /*
      Orderly shutdown, in the order that loses nothing: stop accepting connections, let in-flight
      requests finish, then close the queue workers, the cache and the database.
     */
    const SHUTDOWN_GRACE_MS = 10_000;
    let shuttingDown = false;

    const shutdown = async (reason: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[shutdown] ${reason} — closing`);

        // A client holding a keep-alive connection open shouldn't hold the deploy open with it.
        const forceExit = setTimeout(() => {
            console.error("[shutdown] in-flight requests did not finish in time — exiting anyway");
            process.exit(1);
        }, SHUTDOWN_GRACE_MS);
        forceExit.unref();

        try {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            await closeWorkers();
            await cache.close();
            await closeDB();
            console.log("[shutdown] complete");
            process.exit(0);
        } catch (error) {
            console.error("[shutdown] failed:", error);
            process.exit(1);
        }
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));

    // A rejection nobody handled is logged, then taken down the same orderly path.
    process.on("unhandledRejection", (reason) => {
        console.error("[fatal] unhandled promise rejection:", reason);
        void shutdown("unhandledRejection");
    });

    process.on("uncaughtException", (error) => {
        console.error("[fatal] uncaught exception:", error);
        void shutdown("uncaughtException");
    });
}

main().catch((error) => {
    console.error("[startup] failed:", error);
    process.exit(1);
});
