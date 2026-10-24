import crypto from "node:crypto";
import { WebSocket, type RawData } from "ws";
import {
    CLOSE,
    REALTIME_LIMITS,
    type FrameType,
    type RealtimeUserInfo,
    type ServerFrame,
} from "@repo/types";
import type { TicketPayload } from "./tickets";

export class TokenBucket {
    private tokens: number;
    private lastRefill: number;

    constructor(
        private readonly capacity: number,
        private readonly refillPerSecond: number
    ) {
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    take(cost = 1): boolean {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
        this.lastRefill = now;

        if (this.tokens >= cost) {
            this.tokens -= cost;
            return true;
        }
        return false;
    }
}

// Frames that arrive between the upgrade and the room finishing its load are held, not dropped.
const MAX_BUFFERED_FRAMES = 64;
const PRESENCE_DROP_BYTES = 512_000;
const BACKPRESSURE_BYTES = 1_000_000;
const BACKPRESSURE_CLOSE_AFTER_MS = 10_000;

export type MessageHandler = (raw: RawData, isBinary: boolean) => void;

export class Connection {
    public readonly id: string;
    public readonly userId: string;
    public readonly roomId: string;
    public readonly userInfo: RealtimeUserInfo;
    public isAlive = true;
    public closed = false;

    private pingTimer?: NodeJS.Timeout;
    private highBufferSince?: number;
    private handler?: MessageHandler;
    private closeHandler?: () => void;
    private buffered: { raw: RawData; isBinary: boolean }[] = [];

    // Rate limiter buckets per connection
    private updateBucket = new TokenBucket(120, 60); // 120 burst, 60/s
    private presenceBucket = new TokenBucket(80, 40); // 80 burst, 40/s
    private feedBucket = new TokenBucket(30, 5); // 30 burst, 5/s
    private flushBucket = new TokenBucket(3, 0.2); // explicit saves: 3 burst, one per 5 s

    constructor(
        public readonly ws: WebSocket,
        ticket: TicketPayload,
        connectionId?: string,
        heartbeatMs: number = REALTIME_LIMITS.heartbeatMs
    ) {
        this.id = connectionId ?? crypto.randomUUID();
        this.userId = ticket.userId;
        this.roomId = ticket.roomId;
        this.userInfo = ticket.userInfo;

        // Listeners go on now, before any room exists, so no frame sent right after the upgrade can be lost.
        this.ws.on("message", (raw, isBinary) => {
            this.isAlive = true;
            if (this.handler) {
                this.handler(raw, isBinary);
            } else if (this.buffered.length < MAX_BUFFERED_FRAMES) {
                this.buffered.push({ raw, isBinary });
            } else {
                this.close(CLOSE.RATE_LIMITED, "Too many frames before join");
            }
        });
        this.ws.on("pong", () => {
            this.isAlive = true;
        });
        this.ws.on("error", (err) => {
            // ws emits protocol errors (oversized payload, bad frame) here; unhandled, they would crash the process.
            console.warn(`[connection:${this.id}] socket error:`, err.message);
        });
        this.ws.on("close", () => {
            this.closed = true;
            this.stopHeartbeat();
            this.closeHandler?.();
        });

        this.startHeartbeat(heartbeatMs);
    }

    /** Hands the connection to a room: buffered frames are replayed in order, then frames flow straight through. */
    attach(onMessage: MessageHandler, onClose: () => void): void {
        this.handler = onMessage;
        this.closeHandler = onClose;
        const pending = this.buffered;
        this.buffered = [];
        for (const frame of pending) onMessage(frame.raw, frame.isBinary);
    }

    private startHeartbeat(intervalMs: number) {
        this.pingTimer = setInterval(() => {
            if (!this.isAlive) {
                // A dead peer never answers a close handshake, so close() would linger; cut the socket.
                this.terminate();
                return;
            }
            this.isAlive = false;
            try {
                this.ws.ping();
            } catch {
                this.terminate();
            }
        }, intervalMs);
        this.pingTimer.unref?.();
    }

    private stopHeartbeat() {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = undefined;
    }

    takeUpdateToken(): boolean {
        return this.updateBucket.take(1);
    }

    takePresenceToken(): boolean {
        return this.presenceBucket.take(1);
    }

    takeFeedToken(): boolean {
        return this.feedBucket.take(1);
    }

    takeFlushToken(): boolean {
        return this.flushBucket.take(1);
    }

    sendBinary(type: FrameType, payload: Uint8Array): void {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        if (!this.checkBackpressure()) return;

        const frame = new Uint8Array(payload.byteLength + 1);
        frame[0] = type;
        frame.set(payload, 1);

        try {
            this.ws.send(frame, { binary: true });
        } catch (err) {
            console.warn(`[connection:${this.id}] sendBinary failed:`, err);
        }
    }

    sendJson(frame: ServerFrame): void {
        if (this.ws.readyState !== WebSocket.OPEN) return;

        // Presence is ephemeral: the first thing a slow socket loses.
        if (frame.t === "presence:batch" && this.ws.bufferedAmount > PRESENCE_DROP_BYTES) return;
        if (!this.checkBackpressure()) return;

        try {
            this.ws.send(JSON.stringify(frame));
        } catch (err) {
            console.warn(`[connection:${this.id}] sendJson failed:`, err);
        }
    }

    /** False once the socket has been backed up for too long and was closed; it resyncs when it reconnects. */
    private checkBackpressure(): boolean {
        if (this.ws.bufferedAmount <= BACKPRESSURE_BYTES) {
            this.highBufferSince = undefined;
            return true;
        }

        const now = Date.now();
        this.highBufferSince ??= now;
        // Mobile networks stall briefly all the time, so only sustained pressure closes the socket.
        if (now - this.highBufferSince > BACKPRESSURE_CLOSE_AFTER_MS) {
            console.warn(`[connection:${this.id}] closing: sustained backpressure`);
            this.close(CLOSE.TOO_LARGE, "Sustained backpressure");
            return false;
        }
        return true;
    }

    close(code: number, reason: string): void {
        this.stopHeartbeat();
        try {
            if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
                this.ws.close(code, reason.slice(0, 100));
            }
        } catch {
            this.ws.terminate();
        }
    }

    terminate(): void {
        this.stopHeartbeat();
        try {
            this.ws.terminate();
        } catch {
            // Already gone.
        }
    }
}
