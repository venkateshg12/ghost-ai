import { CLOSE, type ClientFrame, type FrameType, type ServerFrame } from "@repo/types";
import { getRealtimeTicket } from "@/api/realtime";
import { REALTIME_URL } from "@/constants/env";
import { MAX_WAKE_RETRIES, isServerUnavailable, wakeRetryDelay } from "@/lib/serverStatus";

export type ConnState = "idle" | "connecting" | "syncing" | "live" | "reconnecting" | "forbidden" | "closed";

// The socket opened but the server never completed the sync handshake: drop it and start over.
const SYNC_TIMEOUT_MS = 10_000;
const MAX_BACKOFF_MS = 30_000;

/*
  One room's socket and its lifecycle. Every connection attempt fetches a fresh single-use ticket through the
  API, so access is re-checked on every reconnect. `live` means the Yjs handshake has completed (see markLive).
 */
export class RealtimeConnection {
    public state: ConnState = "idle";
    private ws: WebSocket | null = null;
    private attempt = 0;
    private reconnectTimer?: ReturnType<typeof setTimeout>;
    private syncTimer?: ReturnType<typeof setTimeout>;
    private isManuallyClosed = false;

    private stateListeners = new Set<(state: ConnState) => void>();
    private binaryListeners = new Set<(type: FrameType, payload: Uint8Array) => void>();
    private jsonListeners = new Set<(frame: ServerFrame) => void>();

    constructor(public readonly roomId: string) {}

    onStateChange(listener: (state: ConnState) => void): () => void {
        this.stateListeners.add(listener);
        listener(this.state);
        return () => this.stateListeners.delete(listener);
    }

    onBinaryMessage(listener: (type: FrameType, payload: Uint8Array) => void): () => void {
        this.binaryListeners.add(listener);
        return () => this.binaryListeners.delete(listener);
    }

    onJsonMessage(listener: (frame: ServerFrame) => void): () => void {
        this.jsonListeners.add(listener);
        return () => this.jsonListeners.delete(listener);
    }

    private setState(newState: ConnState) {
        if (this.state === newState) return;
        this.state = newState;
        for (const cb of this.stateListeners) {
            try {
                cb(newState);
            } catch (err) {
                console.warn("[connection] state listener error:", err);
            }
        }
    }

    /** The server answered our state vector: the document is in sync and the connection is usable. */
    markLive(): void {
        if (this.state !== "syncing") return;
        clearTimeout(this.syncTimer);
        this.attempt = 0;
        this.setState("live");
    }

    async connect(): Promise<void> {
        if (this.state === "connecting" || this.state === "syncing" || this.state === "live") return;
        this.isManuallyClosed = false;
        this.setState("connecting");

        let ticket: string;
        try {
            ({ ticket } = await getRealtimeTicket(this.roomId));
        } catch (error) {
            this.handleTicketFailure(error);
            return;
        }
        if (this.isManuallyClosed) return;

        const base = new URL(REALTIME_URL, typeof window !== "undefined" ? window.location.href : "http://localhost:5000");
        base.protocol = base.protocol === "https:" ? "wss:" : base.protocol === "http:" ? "ws:" : base.protocol;
        base.searchParams.set("ticket", ticket);

        const socket = new WebSocket(base.toString());
        socket.binaryType = "arraybuffer";
        this.ws = socket;

        socket.onopen = () => {
            if (this.ws !== socket) return;
            this.setState("syncing");
            this.syncTimer = setTimeout(() => {
                if (this.ws === socket && this.state === "syncing") socket.close(4000, "Sync timeout");
            }, SYNC_TIMEOUT_MS);
        };

        socket.onmessage = (event) => {
            if (this.ws !== socket) return;
            if (event.data instanceof ArrayBuffer) {
                const bytes = new Uint8Array(event.data);
                if (bytes.byteLength === 0) return;
                const type = bytes[0] as FrameType;
                const payload = bytes.subarray(1);
                for (const cb of this.binaryListeners) cb(type, payload);
            } else if (typeof event.data === "string") {
                try {
                    const parsed = JSON.parse(event.data) as ServerFrame;
                    for (const cb of this.jsonListeners) cb(parsed);
                } catch {
                    // ignore malformed
                }
            }
        };

        socket.onclose = (event) => {
            if (this.ws !== socket) return;
            clearTimeout(this.syncTimer);
            this.ws = null;

            if (this.isManuallyClosed) {
                this.setState("closed");
                return;
            }

            // Removed from the project, or the project was deleted: retrying would only be refused again.
            if (event.code === CLOSE.FORBIDDEN || event.code === CLOSE.ROOM_DELETED) {
                this.setState("forbidden");
                return;
            }

            this.setState("reconnecting");

            // The ticket was refused or expired: a new one is cheap, so try again straight away.
            if (event.code === CLOSE.UNAUTHORIZED) {
                this.scheduleReconnect(0);
                return;
            }

            this.scheduleReconnect(this.nextBackoff());
        };

        socket.onerror = () => {
            // Always followed by onclose, which owns the retry.
        };
    }

    private handleTicketFailure(error: unknown) {
        if (this.isManuallyClosed) return;
        const status = (error as { status?: number } | null)?.status;

        // Not a member (any more), or the project is gone: nothing to retry.
        if (status === 401 || status === 403 || status === 404) {
            this.setState("forbidden");
            return;
        }

        this.setState("reconnecting");
        this.scheduleReconnect(this.nextBackoff(isServerUnavailable(status)));
    }

    // While a free-tier API wakes up, retry on the same schedule as every other request. Otherwise back off exponentially.
    private nextBackoff(serverWaking = false): number {
        const attempt = this.attempt++;
        if (serverWaking && attempt < MAX_WAKE_RETRIES) return wakeRetryDelay(attempt);
        return Math.min(MAX_BACKOFF_MS, 500 * 2 ** Math.min(attempt, 10)) + Math.random() * 500;
    }

    private scheduleReconnect(delayMs: number) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
            if (!this.isManuallyClosed && this.state !== "forbidden") {
                this.connect().catch(() => {});
            }
        }, delayMs);
    }

    /** True when the frame was handed to the socket. Offline edits are not lost: the next handshake sends them. */
    sendBinary(type: FrameType, payload: Uint8Array): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        const frame = new Uint8Array(payload.byteLength + 1);
        frame[0] = type;
        frame.set(payload, 1);
        try {
            this.ws.send(frame.buffer);
            return true;
        } catch (err) {
            console.warn("[connection] sendBinary failed:", err);
            return false;
        }
    }

    sendJson(frame: ClientFrame): boolean {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
        try {
            this.ws.send(JSON.stringify(frame));
            return true;
        } catch (err) {
            console.warn("[connection] sendJson failed:", err);
            return false;
        }
    }

    disconnect(): void {
        this.isManuallyClosed = true;
        clearTimeout(this.reconnectTimer);
        clearTimeout(this.syncTimer);
        const socket = this.ws;
        this.ws = null;
        socket?.close();
        this.setState("closed");
    }
}
