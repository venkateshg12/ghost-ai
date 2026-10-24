import * as Y from "yjs";
import type { RawData } from "ws";
import {
    CLOSE,
    FRAME,
    REALTIME_LIMITS,
    clientFrameSchema,
    getDocEdgesMap,
    getDocNodesMap,
    isValidDocEntry,
    type FrameType,
    type ServerFrame,
    type ServerPresenceChange,
} from "@repo/types";
import { Connection } from "./connection";
import { RoomPresenceManager } from "./presence";
import type { RoomFeeds } from "./feeds";
import type { BusMessage, RealtimeBusLike } from "./bus";
import { rtLog } from "./log";

export interface RoomDeps {
    bus: RealtimeBusLike;
    save: (roomId: string, doc: Y.Doc) => Promise<{ savedAt: number }>;
    createFeeds: (roomId: string, broadcast: (frame: ServerFrame) => void) => RoomFeeds;
    /** How long an empty room stays in memory before it is flushed and dropped. */
    evictAfterMs?: number;
    /** Debounce window and the longest a dirty room waits before saving. */
    saveDebounceMs?: number;
    saveMaxWaitMs?: number;
}

const TRAFFIC_LOG_MS = 10_000;
const SAVE_RETRY_MS = 5_000;

const toRaw = (raw: RawData): Uint8Array => {
    if (Array.isArray(raw)) return new Uint8Array(Buffer.concat(raw));
    if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
    return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
};

export class Room {
    public readonly connections = new Map<string, Connection>();
    public readonly presence: RoomPresenceManager;
    public readonly feeds: RoomFeeds;

    private readonly bus: RealtimeBusLike;
    private readonly evictAfterMs: number;
    private readonly debounceMs: number;
    private readonly maxWaitMs: number;

    private saveTimer?: NodeJS.Timeout;
    private firstDirtyAt?: number;
    private emptyTimer?: NodeJS.Timeout;
    private trafficTimer?: NodeJS.Timeout;
    private dirty = false;
    private saving: Promise<void> | null = null;
    private isDestroyed = false;

    private lastSavedAt: number | null = null;
    private updateBytes = 0;
    private updateBytesAtLastLog = 0;

    // Keys a socket's transaction touched, collected while its update is applied and validated right after.
    private touched = { nodes: new Set<string>(), edges: new Set<string>() };

    constructor(
        public readonly id: string,
        public readonly doc: Y.Doc,
        private readonly onEvict: (roomId: string) => void,
        private readonly deps: RoomDeps
    ) {
        this.bus = deps.bus;
        this.evictAfterMs = deps.evictAfterMs ?? 30_000;
        this.debounceMs = deps.saveDebounceMs ?? 2_000;
        this.maxWaitMs = deps.saveMaxWaitMs ?? 10_000;

        this.presence = new RoomPresenceManager(
            id,
            (changes) => {
                this.broadcastJson({ t: "presence:batch", changes });
                void this.bus.publish(id, "presence", changes);
            },
            (connectionId) => this.announceLeave(connectionId)
        );

        this.feeds = deps.createFeeds(id, (frame) => {
            this.broadcastJson(frame);
            void this.bus.publish(id, "feed", frame);
        });

        this.trackTouchedKeys();

        this.doc.on("update", (update: Uint8Array, origin: unknown) => {
            this.updateBytes += update.byteLength;

            // Everyone except the socket the update came from.
            this.broadcastBinary(FRAME.UPDATE, update, origin instanceof Connection ? origin : undefined);

            // Other instances get it unless it came from them (re-publishing would echo between instances).
            if (origin !== "bus") {
                void this.bus.publish(id, "update", Buffer.from(update).toString("base64"));
            }

            this.markDirty();
        });

        // Once subscribed, ask peers for the state of the room: the blob may be seconds behind, and the cursors of
        // people already connected elsewhere were broadcast before this instance was listening.
        void this.bus
            .subscribe(id, this.handleBusMessage, this.republishState)
            .then(() => (this.isDestroyed ? undefined : this.bus.publish(id, "sync-request", null)));

        this.trafficTimer = setInterval(() => this.logTraffic(), TRAFFIC_LOG_MS);
        this.trafficTimer.unref?.();
    }

    get destroyed(): boolean {
        return this.isDestroyed;
    }

    stats(): { connections: number; updateBytes: number } {
        return { connections: this.connections.size, updateBytes: this.updateBytes };
    }

    private trackTouchedKeys() {
        const record = (target: Y.Map<Y.Map<unknown>>, into: Set<string>) =>
            target.observeDeep((events, tx) => {
                if (!(tx.origin instanceof Connection)) return;
                for (const event of events) {
                    if (event.target === target) {
                        for (const key of (event as Y.YMapEvent<Y.Map<unknown>>).keys.keys()) into.add(key);
                    } else if (typeof event.path[0] === "string") {
                        into.add(event.path[0]);
                    }
                }
            });

        record(getDocNodesMap(this.doc), this.touched.nodes);
        record(getDocEdgesMap(this.doc), this.touched.edges);
    }

    private handleBusMessage = (msg: BusMessage) => {
        if (this.isDestroyed) return;

        switch (msg.kind) {
            case "update": {
                if (typeof msg.payload === "string") {
                    Y.applyUpdate(this.doc, new Uint8Array(Buffer.from(msg.payload, "base64")), "bus");
                }
                break;
            }
            case "presence": {
                if (Array.isArray(msg.payload)) {
                    const changes = msg.payload as ServerPresenceChange[];
                    this.presence.applyRemote(changes);
                    this.broadcastJson({ t: "presence:batch", changes });
                }
                break;
            }
            case "leave": {
                if (typeof msg.payload === "string") {
                    this.presence.removeRemote(msg.payload);
                    this.broadcastJson({ t: "presence:leave", connectionId: msg.payload });
                }
                break;
            }
            case "feed": {
                if (msg.payload && typeof msg.payload === "object") {
                    this.broadcastJson(msg.payload as ServerFrame);
                }
                break;
            }
            case "kick": {
                if (typeof msg.payload === "string") this.kickUser(msg.payload);
                break;
            }
            case "destroy": {
                this.destroy();
                this.onEvict(this.id);
                break;
            }
            case "sync-request": {
                // A peer just opened this room. Pub/sub is not durable, so tell it everything it missed.
                const here = this.presence.getLocal();
                if (here.length > 0) void this.bus.publish(this.id, "presence", here);
                this.republishState();
                break;
            }
        }
    };

    // After the bus was unreachable, peers may have missed updates. Updates are idempotent, so sending the whole
    // state is always safe and brings everyone back to the same document.
    private republishState = () => {
        if (this.isDestroyed) return;
        void this.bus.publish(this.id, "update", Buffer.from(Y.encodeStateAsUpdate(this.doc)).toString("base64"));
    };

    async join(conn: Connection): Promise<void> {
        if (this.isDestroyed) {
            conn.close(CLOSE.ROOM_DELETED, "Room deleted");
            return;
        }

        let sameUser = 0;
        for (const existing of this.connections.values()) if (existing.userId === conn.userId) sameUser++;
        if (sameUser >= REALTIME_LIMITS.maxConnectionsPerUser) {
            rtLog("conn.rejected", { roomId: this.id, userId: conn.userId, reason: "per-user cap" });
            conn.close(CLOSE.RATE_LIMITED, "Too many connections");
            return;
        }

        // Frames the socket sends meanwhile are held by the Connection and replayed by attach() below.
        const recentFeeds = await this.feeds.getRecentMessages();

        // The socket went away, or the room was destroyed, while the history loaded.
        if (conn.closed) return;
        if (this.isDestroyed) {
            conn.close(CLOSE.ROOM_DELETED, "Room deleted");
            return;
        }

        if (this.emptyTimer) {
            clearTimeout(this.emptyTimer);
            this.emptyTimer = undefined;
        }
        this.connections.set(conn.id, conn);
        rtLog("conn.join", { roomId: this.id, connectionId: conn.id, userId: conn.userId, connections: this.connections.size });

        // 1. Who is here and the recent feed history.
        conn.sendJson({
            t: "hello",
            connectionId: conn.id,
            presence: this.presence.getSnapshot(),
            messages: recentFeeds,
        });

        // 2. Open the Yjs handshake: our state vector, so the client sends whatever we lack.
        conn.sendBinary(FRAME.SYNC_STEP1, Y.encodeStateVector(this.doc));

        // 3. Announce the newcomer, then start reading the socket (replaying anything it already sent).
        this.presence.onClientJoin(conn);
        conn.attach(
            (raw, isBinary) => this.handleSocketMessage(conn, raw, isBinary),
            () => this.leave(conn)
        );
    }

    leave(conn: Connection): void {
        if (!this.connections.delete(conn.id)) return;

        this.presence.onClientLeave(conn.id);
        this.announceLeave(conn.id);
        rtLog("conn.leave", { roomId: this.id, connectionId: conn.id, userId: conn.userId, connections: this.connections.size });

        if (this.connections.size === 0 && !this.isDestroyed) {
            void this.flush().catch(() => {});
            this.emptyTimer = setTimeout(() => void this.evictIfEmpty(), this.evictAfterMs);
            this.emptyTimer.unref?.();
        }
    }

    private announceLeave(connectionId: string) {
        this.broadcastJson({ t: "presence:leave", connectionId });
        void this.bus.publish(this.id, "leave", connectionId);
    }

    private async evictIfEmpty() {
        // Wait for any save still in flight, so eviction never races a write.
        await this.flush().catch(() => {});
        if (this.connections.size > 0 || this.isDestroyed) return;
        this.destroy();
        this.onEvict(this.id);
    }

    private handleSocketMessage(conn: Connection, raw: RawData, isBinary: boolean): void {
        const buffer = toRaw(raw);
        if (buffer.byteLength > REALTIME_LIMITS.maxFrameBytes) {
            conn.close(CLOSE.TOO_LARGE, "Frame size exceeded limit");
            return;
        }

        if (isBinary) this.handleBinaryMessage(conn, buffer);
        else this.handleTextMessage(conn, Buffer.from(buffer).toString("utf8"));
    }

    private handleBinaryMessage(conn: Connection, buffer: Uint8Array): void {
        if (buffer.byteLength === 0) return;

        const type = buffer[0] as FrameType;
        const payload = buffer.subarray(1);

        switch (type) {
            case FRAME.SYNC_STEP1: {
                // The client's vector: reply with exactly what it is missing.
                conn.sendBinary(FRAME.SYNC_STEP2, Y.encodeStateAsUpdate(this.doc, payload));
                break;
            }
            case FRAME.SYNC_STEP2:
            case FRAME.UPDATE: {
                if (!conn.takeUpdateToken()) {
                    conn.close(CLOSE.RATE_LIMITED, "Update rate limit exceeded");
                    return;
                }

                try {
                    Y.applyUpdate(this.doc, payload, conn);
                } catch (err) {
                    console.warn(`[room:${this.id}] malformed Yjs update:`, err);
                    conn.close(1003, "Malformed update");
                    return;
                }

                if (!this.validateTouched(conn)) return;

                if (getDocNodesMap(this.doc).size > REALTIME_LIMITS.maxNodes || getDocEdgesMap(this.doc).size > REALTIME_LIMITS.maxEdges) {
                    conn.close(CLOSE.TOO_LARGE, "Document node/edge limits exceeded");
                }
                break;
            }
        }
    }

    /*
      A CRDT cannot refuse an operation once it is merged, so what a socket wrote is checked afterwards. Anything
      malformed is deleted again (a normal transaction every replica applies) and the socket is closed.
     */
    private validateTouched(conn: Connection): boolean {
        const nodes = getDocNodesMap(this.doc);
        const edges = getDocEdgesMap(this.doc);
        const badNodes = [...this.touched.nodes].filter((key) => !isValidDocEntry("node", key, nodes.get(key)));
        const badEdges = [...this.touched.edges].filter((key) => !isValidDocEntry("edge", key, edges.get(key)));
        this.touched.nodes.clear();
        this.touched.edges.clear();

        if (badNodes.length === 0 && badEdges.length === 0) return true;

        this.doc.transact(() => {
            for (const key of badNodes) nodes.delete(key);
            for (const key of badEdges) edges.delete(key);
        }, "quarantine");

        rtLog("update.rejected", { roomId: this.id, userId: conn.userId, nodes: badNodes.length, edges: badEdges.length });
        conn.close(CLOSE.TOO_LARGE, "Invalid node or edge");
        return false;
    }

    private handleTextMessage(conn: Connection, text: string): void {
        if (!text) return;

        let json: unknown;
        try {
            json = JSON.parse(text);
        } catch {
            return;
        }

        const parsed = clientFrameSchema.safeParse(json);
        if (!parsed.success) return;

        const frame = parsed.data;
        switch (frame.t) {
            case "presence": {
                if (!conn.takePresenceToken()) {
                    conn.close(CLOSE.RATE_LIMITED, "Presence rate limit exceeded");
                    return;
                }
                this.presence.onClientPresence(conn, frame.presence);
                break;
            }
            case "feed:create": {
                if (!conn.takeFeedToken()) {
                    conn.close(CLOSE.RATE_LIMITED, "Feed rate limit exceeded");
                    return;
                }
                this.feeds.onClientFeedCreate(conn, frame.feed, frame.data).catch(() => {});
                break;
            }
            case "flush": {
                // "Save now". Rate limited, because every real save writes two blobs.
                if (!conn.takeFlushToken()) return;
                this.flush(true).catch(() => {});
                break;
            }
        }
    }

    broadcastBinary(type: FrameType, payload: Uint8Array, except?: Connection): void {
        for (const conn of this.connections.values()) {
            if (conn !== except) conn.sendBinary(type, payload);
        }
    }

    broadcastJson(frame: ServerFrame): void {
        for (const conn of this.connections.values()) conn.sendJson(frame);
    }

    markDirty(): void {
        this.dirty = true;
        this.firstDirtyAt ??= Date.now();
        this.scheduleSave(Math.min(this.debounceMs, this.maxWaitMs - (Date.now() - this.firstDirtyAt)));
    }

    private scheduleSave(waitMs: number) {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.flush().catch((err) => console.warn(`[room:${this.id}] flush error:`, err));
        }, Math.max(0, waitMs));
        this.saveTimer.unref?.();
    }

    /**
     * Writes the room to storage. Only when something changed, unless `force` (the user pressed Save). Calls
     * queue behind a save already running, and an edit that lands during a save is saved by the next one.
     */
    async flush(force = false): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = undefined;
        }

        while (this.saving) await this.saving;
        if (!this.dirty && !force) return;

        this.saving = this.runSave();
        try {
            await this.saving;
        } finally {
            this.saving = null;
        }
    }

    private async runSave(): Promise<void> {
        this.dirty = false;
        this.firstDirtyAt = undefined;

        // Only one instance writes a room's blob at a time. If another holds the lock it has the same state.
        if (!(await this.bus.acquireSaveLock(this.id))) {
            this.broadcastJson({ t: "saved", timestamp: Date.now() });
            return;
        }

        try {
            const { savedAt } = await this.deps.save(this.id, this.doc);
            this.lastSavedAt = savedAt;
            rtLog("room.saved", { roomId: this.id, bytes: this.updateBytes });
            this.broadcastJson({ t: "saved", timestamp: savedAt });
        } catch (err) {
            console.warn(`[room:${this.id}] save failed:`, err);
            this.dirty = true;
            this.broadcastJson({ t: "error", code: 500, message: "Saving failed. Retrying." });
            if (!this.isDestroyed) this.scheduleSave(SAVE_RETRY_MS);
        }
    }

    kickUser(userId: string): void {
        for (const conn of this.connections.values()) {
            if (conn.userId === userId) conn.close(CLOSE.FORBIDDEN, "Access revoked");
        }
    }

    private logTraffic() {
        const delta = this.updateBytes - this.updateBytesAtLastLog;
        this.updateBytesAtLastLog = this.updateBytes;
        if (delta > 0) {
            rtLog("room.traffic", {
                roomId: this.id,
                connections: this.connections.size,
                updateBytesPerSec: Math.round(delta / (TRAFFIC_LOG_MS / 1000)),
            });
        }
    }

    destroy(): void {
        if (this.isDestroyed) return;
        this.isDestroyed = true;

        if (this.emptyTimer) clearTimeout(this.emptyTimer);
        if (this.saveTimer) clearTimeout(this.saveTimer);
        if (this.trafficTimer) clearInterval(this.trafficTimer);

        this.bus.unsubscribe(this.id, this.handleBusMessage);

        for (const conn of this.connections.values()) conn.close(CLOSE.ROOM_DELETED, "Room deleted");
        this.connections.clear();
        this.presence.destroy();
    }
}
