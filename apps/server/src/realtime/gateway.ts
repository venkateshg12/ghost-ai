import type http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { REALTIME_LIMITS } from "@repo/types";
import { CORS_ORIGIN } from "../constants/env";
import { consumeTicket } from "./tickets";
import { Connection } from "./connection";
import { roomManager, type RoomManager } from "./roomManager";
import { rtLog } from "./log";

const allowedOrigins = CORS_ORIGIN.split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const rejectUpgrade = (socket: Duplex, statusCode: number, statusText: string) => {
    socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
    socket.destroy();
};

/**
 * Accepts WebSocket upgrades on `/realtime`, and nothing else. A browser always sends `Origin` and CORS does not
 * apply to WebSockets, so the origin is checked here (cross-site WebSocket hijacking), then the single-use ticket.
 */
export const attachRealtime = (server: http.Server, manager: RoomManager = roomManager): WebSocketServer => {
    // The hard backstop. A frame over maxFrameBytes but under this reaches the room, which closes the socket
    // with the application code 4413 instead of ws's generic 1009.
    const wss = new WebSocketServer({ noServer: true, maxPayload: REALTIME_LIMITS.maxFrameBytes * 4 });

    server.on("upgrade", async (req, socket, head) => {
        socket.on("error", () => socket.destroy());

        try {
            const parsedUrl = new URL(req.url ?? "", "http://localhost");
            if (parsedUrl.pathname !== "/realtime") {
                return socket.destroy();
            }

            const origin = (req.headers.origin ?? "").trim();
            if (!allowedOrigins.includes(origin)) {
                console.warn(`[gateway] Rejected WebSocket origin: "${origin}"`);
                return rejectUpgrade(socket, 403, "Forbidden");
            }

            const payload = await consumeTicket(parsedUrl.searchParams.get("ticket") ?? "");
            if (!payload) {
                console.warn("[gateway] Rejected WebSocket: missing, invalid or expired ticket");
                return rejectUpgrade(socket, 401, "Unauthorized");
            }

            wss.handleUpgrade(req, socket, head, (ws) => {
                // The Connection starts listening immediately; the room attaches once it has loaded.
                const conn = new Connection(ws, payload);
                manager.join(payload.roomId, conn).catch((error) => {
                    rtLog("conn.join.failed", { roomId: payload.roomId, error: String(error) });
                    conn.close(1011, "Could not join room");
                });
            });
        } catch (error) {
            console.error("[gateway] Upgrade error:", error);
            rejectUpgrade(socket, 500, "Internal Server Error");
        }
    });

    return wss;
};
