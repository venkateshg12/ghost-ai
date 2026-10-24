import * as Y from "yjs";
import {
    AI_CHAT_FEED,
    FRAME,
    REALTIME_LIMITS,
    toFlowGraph,
    type ChatMessagePayload,
    type DocFlowGraph,
    type FeedMessage,
    type FrameType,
    type Presence,
    type ServerFrame,
    type ServerPresenceChange,
} from "@repo/types";
import { ConnState, RealtimeConnection } from "./connection";
import { FlowUndoManager } from "./undo";

export interface RoomStatus {
    state: ConnState;
    /** Between "start connecting" and "handshake done". */
    isConnecting: boolean;
    isLive: boolean;
    isReconnecting: boolean;
    isForbidden: boolean;
    /** The document has been received from the server at least once, so the canvas can be shown. */
    hasSynced: boolean;
    lastSavedAt: number | null;
    /** Set when the server reported that saving failed; cleared by the next successful save. */
    saveError: boolean;
}

// Chat lines typed while offline wait for the next connection, up to a limit.
const MAX_QUEUED_CHAT = 20;

export class RoomClient {
    public readonly doc: Y.Doc;
    public readonly connection: RealtimeConnection;
    public readonly undoManager: FlowUndoManager;

    public myConnectionId: string | null = null;
    public selfPresence: Presence = { cursor: null, thinking: false };
    public others = new Map<string, ServerPresenceChange>();
    public feeds: Record<string, FeedMessage[]> = {};
    public lastSavedAt: number | null = null;

    public presenceVersion = 0;
    public selfVersion = 0;
    public feedVersions: Record<string, number> = {};

    private presenceListeners = new Set<() => void>();
    private selfListeners = new Set<() => void>();
    private feedListeners = new Map<string, Set<() => void>>();
    private statusListeners = new Set<(status: RoomStatus) => void>();
    private docListeners = new Set<() => void>();

    private presenceThrottleTimer?: ReturnType<typeof setTimeout>;
    private hasInitialSync = false;
    private saveError = false;
    private queuedChat: ChatMessagePayload[] = [];
    private status: RoomStatus;
    private disconnected = false;

    constructor(public readonly roomId: string) {
        this.doc = new Y.Doc();
        this.connection = new RealtimeConnection(roomId);
        this.undoManager = new FlowUndoManager(this.doc);
        this.status = this.computeStatus();

        this.setupConnectionListeners();
        this.setupDocListeners();
    }

    private setupConnectionListeners() {
        this.connection.onStateChange((state) => {
            if (state === "syncing") {
                // Open the handshake: our state vector tells the server what we already have.
                this.connection.sendBinary(FRAME.SYNC_STEP1, Y.encodeStateVector(this.doc));
            }
            if (state === "reconnecting" && this.others.size > 0) {
                // Their cursors would otherwise freeze on screen until the server tells us who is still here.
                this.others.clear();
                this.notifyPresence();
            }
            this.refreshStatus();
        });

        this.connection.onBinaryMessage((type: FrameType, payload: Uint8Array) => {
            switch (type) {
                case FRAME.SYNC_STEP1: {
                    // The server's vector: send back whatever it lacks (edits made offline).
                    this.connection.sendBinary(FRAME.SYNC_STEP2, Y.encodeStateAsUpdate(this.doc, payload));
                    break;
                }
                case FRAME.SYNC_STEP2: {
                    Y.applyUpdate(this.doc, payload, "remote");
                    if (!this.hasInitialSync) {
                        this.hasInitialSync = true;
                        // The loaded graph is the baseline, not something to undo.
                        this.undoManager.clear();
                    }
                    this.connection.markLive();
                    this.refreshStatus();
                    this.notifyDoc();
                    break;
                }
                case FRAME.UPDATE: {
                    Y.applyUpdate(this.doc, payload, "remote");
                    this.notifyDoc();
                    break;
                }
            }
        });

        this.connection.onJsonMessage((frame: ServerFrame) => {
            switch (frame.t) {
                case "hello": {
                    this.myConnectionId = frame.connectionId;
                    this.others.clear();
                    for (const p of frame.presence) {
                        if (p.connectionId !== this.myConnectionId) this.others.set(p.connectionId, p);
                    }
                    if (frame.messages) this.feeds = { ...frame.messages };
                    this.notifyPresence();
                    this.notifySelf();
                    this.notifyAllFeeds();

                    // A fresh connection knows nothing of our cursor or "thinking" flag, and may owe us queued chat.
                    this.connection.sendJson({ t: "presence", presence: this.selfPresence });
                    this.flushQueuedChat();
                    break;
                }
                case "presence:batch": {
                    for (const change of frame.changes) {
                        if (change.connectionId !== this.myConnectionId) this.others.set(change.connectionId, change);
                    }
                    this.notifyPresence();
                    break;
                }
                case "presence:leave": {
                    this.others.delete(frame.connectionId);
                    this.notifyPresence();
                    break;
                }
                case "feed:create": {
                    const list = this.feeds[frame.feed] ?? (this.feeds[frame.feed] = []);
                    if (!list.some((m) => m.id === frame.message.id)) list.push(frame.message);
                    this.notifyFeed(frame.feed);
                    break;
                }
                case "feed:update": {
                    const list = this.feeds[frame.feed] ?? (this.feeds[frame.feed] = []);
                    const idx = list.findIndex((m) => m.id === frame.message.id);
                    if (idx >= 0) list[idx] = frame.message;
                    else list.push(frame.message);
                    this.notifyFeed(frame.feed);
                    break;
                }
                case "saved": {
                    this.lastSavedAt = frame.timestamp;
                    this.saveError = false;
                    this.refreshStatus();
                    break;
                }
                case "error": {
                    this.saveError = true;
                    this.refreshStatus();
                    break;
                }
            }
        });
    }

    private setupDocListeners() {
        this.doc.on("update", (update: Uint8Array, origin: unknown) => {
            // Only local edits go out. Offline ones are not lost: the next handshake sends them.
            if (origin !== "remote") this.connection.sendBinary(FRAME.UPDATE, update);
            this.notifyDoc();
        });
    }

    getSnapshot(): DocFlowGraph {
        return toFlowGraph(this.doc);
    }

    private computeStatus(): RoomStatus {
        const state = this.connection.state;
        return {
            state,
            isConnecting: state === "connecting" || state === "syncing",
            isLive: state === "live",
            isReconnecting: state === "reconnecting",
            isForbidden: state === "forbidden",
            hasSynced: this.hasInitialSync,
            lastSavedAt: this.lastSavedAt,
            saveError: this.saveError,
        };
    }

    /** The same object until something changes, which is what useSyncExternalStore needs from a snapshot. */
    getStatus(): RoomStatus {
        return this.status;
    }

    private refreshStatus() {
        const next = this.computeStatus();
        const prev = this.status;
        const changed = (Object.keys(next) as (keyof RoomStatus)[]).some((key) => next[key] !== prev[key]);
        if (!changed) return;

        this.status = next;
        for (const cb of this.statusListeners) cb(next);
    }

    updateMyPresence(patch: Partial<Presence>): void {
        this.selfPresence = { ...this.selfPresence, ...patch };
        this.notifySelf();

        if (!this.presenceThrottleTimer) {
            this.presenceThrottleTimer = setTimeout(() => {
                this.presenceThrottleTimer = undefined;
                this.connection.sendJson({ t: "presence", presence: this.selfPresence });
            }, REALTIME_LIMITS.presenceIntervalMs);
        }
    }

    /** Sends a chat line, or holds it until the connection is back. */
    createChatMessage(data: ChatMessagePayload): void {
        if (this.connection.sendJson({ t: "feed:create", feed: AI_CHAT_FEED, data })) return;
        if (this.queuedChat.length < MAX_QUEUED_CHAT) this.queuedChat.push(data);
    }

    private flushQueuedChat() {
        const queued = this.queuedChat;
        this.queuedChat = [];
        for (const data of queued) this.createChatMessage(data);
    }

    /** Asks the server to save now. False when there is no connection to ask. */
    saveNow(): boolean {
        return this.connection.sendJson({ t: "flush" });
    }

    // Subscriptions
    subscribeDoc(listener: () => void): () => void {
        this.docListeners.add(listener);
        return () => this.docListeners.delete(listener);
    }

    subscribePresence(listener: () => void): () => void {
        this.presenceListeners.add(listener);
        return () => this.presenceListeners.delete(listener);
    }

    subscribeSelf(listener: () => void): () => void {
        this.selfListeners.add(listener);
        return () => this.selfListeners.delete(listener);
    }

    subscribeFeed(feed: string, listener: () => void): () => void {
        let set = this.feedListeners.get(feed);
        if (!set) {
            set = new Set();
            this.feedListeners.set(feed, set);
        }
        set.add(listener);
        return () => set?.delete(listener);
    }

    subscribeStatus(listener: (status: RoomStatus) => void): () => void {
        this.statusListeners.add(listener);
        return () => this.statusListeners.delete(listener);
    }

    private notifyDoc() {
        for (const cb of this.docListeners) cb();
    }

    private notifyPresence() {
        this.presenceVersion++;
        for (const cb of this.presenceListeners) cb();
    }

    private notifySelf() {
        this.selfVersion++;
        for (const cb of this.selfListeners) cb();
    }

    private notifyFeed(feed: string) {
        this.feedVersions[feed] = (this.feedVersions[feed] || 0) + 1;
        for (const cb of this.feedListeners.get(feed) ?? []) cb();
    }

    private notifyAllFeeds() {
        for (const feed of Object.keys(this.feeds)) {
            this.feedVersions[feed] = (this.feedVersions[feed] || 0) + 1;
        }
        for (const set of this.feedListeners.values()) {
            for (const cb of set) cb();
        }
    }

    connect(): void {
        if (this.disconnected) return;
        this.connection.connect().catch((err) => {
            console.warn("[RoomClient] connect failed:", err);
        });
    }

    /** Final: a RoomClient is not reusable after this (its document is destroyed). Make a new one to reconnect. */
    disconnect(): void {
        if (this.disconnected) return;
        this.disconnected = true;
        clearTimeout(this.presenceThrottleTimer);
        this.connection.disconnect();
        this.undoManager.destroy();
        this.doc.destroy();
    }
}
