import { describe, expect, it } from "vitest";
import { RealtimeBus } from "./bus";

// SET key value PX ttl NX, GET and PEXPIRE with Redis's semantics.
const fakeRedis = () => {
    const store = new Map<string, string>();
    return {
        store,
        set: async (key: string, value: string) => {
            if (store.has(key)) return null;
            store.set(key, value);
            return "OK";
        },
        get: async (key: string) => store.get(key) ?? null,
        pexpire: async () => 1,
    };
};

const connectedBus = (redis: ReturnType<typeof fakeRedis>) => {
    const bus = new RealtimeBus();
    Object.assign(bus as unknown as Record<string, unknown>, { pubClient: redis, pubReady: true });
    return bus;
};

describe("save lock", () => {
    // Regression: the lock is never released, so the instance that holds it could not take it again, and its own
    // next save inside the 10 s window was skipped (and lost on eviction or shutdown).
    it("lets the instance that holds the lock take it again", async () => {
        const bus = connectedBus(fakeRedis());
        expect(await bus.acquireSaveLock("room")).toBe(true);
        expect(await bus.acquireSaveLock("room")).toBe(true);
    });

    it("refuses an instance while another holds it", async () => {
        const redis = fakeRedis();
        const a = connectedBus(redis);
        const b = connectedBus(redis);
        expect(await a.acquireSaveLock("room")).toBe(true);
        expect(await b.acquireSaveLock("room")).toBe(false);
    });

    it("is per room", async () => {
        const redis = fakeRedis();
        const a = connectedBus(redis);
        const b = connectedBus(redis);
        await a.acquireSaveLock("room-1");
        expect(await b.acquireSaveLock("room-2")).toBe(true);
    });

    it("lets every instance save when Redis is not available", async () => {
        const bus = new RealtimeBus(); // never started: no connection
        expect(await bus.acquireSaveLock("room")).toBe(true);
    });

    it("does not throw or connect when publishing without Redis", async () => {
        const bus = new RealtimeBus();
        await expect(bus.publish("room", "update", "x")).resolves.toBeUndefined();
    });
});
