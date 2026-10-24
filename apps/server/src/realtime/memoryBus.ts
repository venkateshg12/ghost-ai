import crypto from "node:crypto";
import type { BusKind, BusListener, BusMessage, RealtimeBusLike } from "./bus";

/*
  An in-process stand-in for Redis pub/sub: several "instances" share one hub. Used to prove cross-instance
  behaviour in tests and in the load script without a Redis server. Delivery is asynchronous, like the network.
 */
export class MemoryBusHub {
    private readonly instances = new Set<MemoryBus>();
    private readonly locks = new Map<string, { holder: string; expiresAt: number }>();
    private down = false;

    createBus(): MemoryBus {
        const bus = new MemoryBus(this);
        this.instances.add(bus);
        return bus;
    }

    /** Simulates a Redis outage: publishes are dropped until `setDown(false)`, which makes every bus reconnect. */
    setDown(down: boolean): void {
        const wasDown = this.down;
        this.down = down;
        if (wasDown && !down) {
            for (const bus of this.instances) bus.fireReconnect();
        }
    }

    deliver(from: MemoryBus, roomId: string, message: BusMessage): void {
        if (this.down) return;
        for (const bus of this.instances) {
            if (bus !== from) queueMicrotask(() => bus.receive(roomId, message));
        }
    }

    acquireLock(roomId: string, holder: string, ttlMs: number): boolean {
        if (this.down) return true;
        const now = Date.now();
        const current = this.locks.get(roomId);
        if (current && current.expiresAt > now && current.holder !== holder) return false;
        this.locks.set(roomId, { holder, expiresAt: now + ttlMs });
        return true;
    }
}

export class MemoryBus implements RealtimeBusLike {
    public readonly instanceId = crypto.randomUUID().slice(0, 8);
    private listeners = new Map<string, Set<BusListener>>();
    private reconnects = new Map<string, Set<() => void>>();

    constructor(private readonly hub: MemoryBusHub) {}

    async subscribe(roomId: string, listener: BusListener, onReconnect?: () => void): Promise<void> {
        let set = this.listeners.get(roomId);
        if (!set) this.listeners.set(roomId, (set = new Set()));
        set.add(listener);
        if (onReconnect) {
            let callbacks = this.reconnects.get(roomId);
            if (!callbacks) this.reconnects.set(roomId, (callbacks = new Set()));
            callbacks.add(onReconnect);
        }
    }

    unsubscribe(roomId: string, listener?: BusListener): void {
        const set = this.listeners.get(roomId);
        if (!set) return;
        if (listener) set.delete(listener);
        if (!listener || set.size === 0) {
            this.listeners.delete(roomId);
            this.reconnects.delete(roomId);
        }
    }

    async publish(roomId: string, kind: BusKind, payload: unknown): Promise<void> {
        this.hub.deliver(this, roomId, { instanceId: this.instanceId, kind, payload: JSON.parse(JSON.stringify(payload ?? null)) });
    }

    async acquireSaveLock(roomId: string, ttlMs = 10_000): Promise<boolean> {
        return this.hub.acquireLock(roomId, this.instanceId, ttlMs);
    }

    receive(roomId: string, message: BusMessage): void {
        for (const cb of this.listeners.get(roomId) ?? []) cb(message);
    }

    fireReconnect(): void {
        for (const callbacks of this.reconnects.values()) for (const cb of callbacks) cb();
    }
}
