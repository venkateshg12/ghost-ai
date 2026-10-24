import crypto from "node:crypto";
import Redis from "ioredis";
import { getRedisConfig } from "../config/redis";
import { rtLog } from "./log";

export type BusKind = "update" | "presence" | "leave" | "feed" | "kick" | "destroy" | "sync-request";

export interface BusMessage {
    instanceId: string;
    kind: BusKind;
    payload: unknown;
}

export type BusListener = (msg: BusMessage) => void;

/** What a Room needs from the cross-instance bus. Redis implements it; tests use an in-memory hub. */
export interface RealtimeBusLike {
    readonly instanceId: string;
    /**
     * `onReconnect` runs whenever the bus (re)connects, so a room can republish what peers may have missed.
     * Resolves once the subscription is active, i.e. once messages from peers will actually arrive.
     */
    subscribe(roomId: string, listener: BusListener, onReconnect?: () => void): Promise<void>;
    unsubscribe(roomId: string, listener?: BusListener): void;
    publish(roomId: string, kind: BusKind, payload: unknown): Promise<void>;
    acquireSaveLock(roomId: string, ttlMs?: number): Promise<boolean>;
}

const CHANNEL_PREFIX = "rt:room:";

/*
  Redis pub/sub between API instances. Publisher and subscriber are separate connections because a subscribed
  connection cannot issue other commands. Nothing connects until the first room subscribes, so a process that
  only imports this module (a Trigger.dev task) never opens a socket.

  Redis being down is not an error for the instance: it keeps serving its own sockets, publishes are dropped
  quietly (one log line per outage, not one per update), and when the connection returns every room republishes
  its state so the instances reconcile.
 */
export class RealtimeBus implements RealtimeBusLike {
    public readonly instanceId: string;
    private pubClient?: Redis;
    private subClient?: Redis;
    private started = false;
    private pubReady = false;
    private roomListeners = new Map<string, Set<BusListener>>();
    private reconnectListeners = new Map<string, Set<() => void>>();

    constructor() {
        this.instanceId = crypto.randomUUID().slice(0, 8);
    }

    private start(): void {
        if (this.started) return;
        this.started = true;

        let config;
        try {
            config = getRedisConfig();
        } catch (err) {
            console.warn("[bus] Redis config unavailable, running in single-instance mode:", err);
            return;
        }

        // Fails fast while disconnected: a dropped publish is cheaper than a growing queue, and peers resync on reconnect.
        this.pubClient = new Redis({ ...config, maxRetriesPerRequest: 1, connectTimeout: 2000, enableOfflineQueue: false });
        // Keeps the offline queue, so a subscribe issued before the connection is up is sent once it is.
        this.subClient = new Redis({ ...config, connectTimeout: 2000 });

        this.pubClient.on("ready", () => {
            if (!this.pubReady) rtLog("bus.publisher.up", { instanceId: this.instanceId });
            this.pubReady = true;
        });
        const pubDown = (reason: string) => {
            if (this.pubReady) rtLog("bus.publisher.down", { instanceId: this.instanceId, reason });
            this.pubReady = false;
        };
        this.pubClient.on("close", () => pubDown("close"));
        this.pubClient.on("error", (err) => pubDown(err.message));

        this.subClient.on("error", () => {});
        this.subClient.on("ready", () => {
            // ioredis resubscribes known channels itself; doing it again is harmless and covers the first connect.
            for (const roomId of this.roomListeners.keys()) {
                this.subClient?.subscribe(`${CHANNEL_PREFIX}${roomId}`).catch(() => {});
            }
            for (const callbacks of this.reconnectListeners.values()) {
                for (const cb of callbacks) cb();
            }
        });

        this.subClient.on("message", (channel, raw) => {
            if (!channel.startsWith(CHANNEL_PREFIX)) return;
            const roomId = channel.slice(CHANNEL_PREFIX.length);

            let message: BusMessage;
            try {
                message = JSON.parse(raw) as BusMessage;
            } catch {
                return;
            }
            if (message.instanceId === this.instanceId) return;

            for (const cb of this.roomListeners.get(roomId) ?? []) {
                try {
                    cb(message);
                } catch (e) {
                    console.warn(`[bus] listener error in room ${roomId}:`, e);
                }
            }
        });
    }

    subscribe(roomId: string, listener: BusListener, onReconnect?: () => void): Promise<void> {
        this.start();

        let subscribed: Promise<void> = Promise.resolve();
        let listeners = this.roomListeners.get(roomId);
        if (!listeners) {
            listeners = new Set();
            this.roomListeners.set(roomId, listeners);
            if (this.subClient) {
                subscribed = this.subClient.subscribe(`${CHANNEL_PREFIX}${roomId}`).then(
                    () => undefined,
                    (err) => console.warn(`[bus] Failed to subscribe to ${CHANNEL_PREFIX}${roomId}:`, err.message)
                );
            }
        }
        listeners.add(listener);

        if (onReconnect) {
            let callbacks = this.reconnectListeners.get(roomId);
            if (!callbacks) this.reconnectListeners.set(roomId, (callbacks = new Set()));
            callbacks.add(onReconnect);
        }
        return subscribed;
    }

    unsubscribe(roomId: string, listener?: BusListener): void {
        const listeners = this.roomListeners.get(roomId);
        if (!listeners) return;

        if (listener) listeners.delete(listener);

        if (!listener || listeners.size === 0) {
            this.roomListeners.delete(roomId);
            this.reconnectListeners.delete(roomId);
            this.subClient?.unsubscribe(`${CHANNEL_PREFIX}${roomId}`).catch(() => {});
        }
    }

    async publish(roomId: string, kind: BusKind, payload: unknown): Promise<void> {
        if (!this.pubClient || !this.pubReady) return;

        const message: BusMessage = { instanceId: this.instanceId, kind, payload };
        try {
            await this.pubClient.publish(`${CHANNEL_PREFIX}${roomId}`, JSON.stringify(message));
        } catch {
            // Dropped: peers reconcile when the connection is back (see start()).
        }
    }

    /*
      Only one instance writes a room's blob at a time. The lock is held for ttlMs and is not released, so the
      instance that holds it must be allowed to take it again: its next save inside the window is its own.
      Without Redis every instance saves, which is safe because the writes are the same compacted state.
     */
    async acquireSaveLock(roomId: string, ttlMs = 10_000): Promise<boolean> {
        if (!this.pubClient || !this.pubReady) return true;

        const key = `rt:save:${roomId}`;
        try {
            const res = await this.pubClient.set(key, this.instanceId, "PX", ttlMs, "NX");
            if (res === "OK") return true;

            const holder = await this.pubClient.get(key);
            if (holder === this.instanceId) {
                await this.pubClient.pexpire(key, ttlMs);
                return true;
            }
            return false;
        } catch {
            return true;
        }
    }

    async close(): Promise<void> {
        try {
            await this.subClient?.quit();
            await this.pubClient?.quit();
        } catch {
            // Already closed.
        }
    }
}

export const realtimeBus = new RealtimeBus();
