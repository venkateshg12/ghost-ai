import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";
import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";

// The only variables the deployed tasks may see. Anything not listed here is never uploaded.
const TASK_ENV = [
    "DATABASE_URL",
    "LIVEBLOCKS_SECRET_KEY",
    "BLOB_READ_WRITE_TOKEN",
    "NVIDIA_API_KEY", "NVIDIA_MODEL", "NVIDIA_BASE_URL", "NVIDIA_RPM",
    "GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_MODEL", "GEMINI_FALLBACK_MODEL",
    "AI_PROVIDER_ORDER", "AI_TIMEOUT_MS", "AI_NVIDIA_TIMEOUT_MS",
    // constants/env.ts requires these at import time even though tasks never use them.
    "CORS_ORIGIN", "CLIENT_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "TRIGGER_SECRET_KEY",
    // Phase 2 (Redis Cloud).
    "REDIS_HOST", "REDIS_PORT", "REDIS_USERNAME", "REDIS_PASSWORD",
] as const;

// A local `.env.production` wins; in CI the values come straight from GitHub secrets or environment.
const fromFile = existsSync(".env.production") ? dotenv.parse(readFileSync(".env.production")) : {};

export default defineConfig({
    project: process.env.TRIGGER_PROJECT_REF ?? "proj_rglguvawhbjtrocebhzd",
    dirs: ["./src/trigger"],
    runtime: "node",
    maxDuration: 300,
    retries: {
        enabledInDev: false,
        default: {
            maxAttempts: 2,
            minTimeoutInMs: 2000,
            maxTimeoutInMs: 10000,
            factor: 2,
            randomize: true,
        },
    },
    build: {
        extensions: [
            syncEnvVars(async ({ environment }) => {
                const source = { ...process.env, ...fromFile };
                const vars: Record<string, string> = {};
                for (const key of TASK_ENV) if (source[key]) vars[key] = String(source[key]);
                // Production tasks must never fall back to the offline generators.
                if (environment === "prod") vars.NODE_ENV = "production";
                return vars;
            }),
        ],
    },
});
