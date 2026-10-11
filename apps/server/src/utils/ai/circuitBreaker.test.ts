import { describe, expect, it } from "vitest";
import { isOpen, recordFailure, recordSuccess, type CircuitBreakerRedis } from "./circuitBreaker";

const createFakeRedis = (): CircuitBreakerRedis => {
    const store = new Map<string, string | number>();
    return {
        incr: async (key: string) => {
            const current = (Number(store.get(key)) || 0) + 1;
            store.set(key, current);
            return current;
        },
        expire: async () => 1,
        set: async (key: string, value: string) => {
            store.set(key, value);
            return "OK";
        },
        del: async (key: string) => {
            const existed = store.delete(key);
            return existed ? 1 : 0;
        },
        exists: async (key: string) => {
            return store.has(key) ? 1 : 0;
        },
    };
};

describe("circuitBreaker", () => {
    it("starts closed", async () => {
        const redis = createFakeRedis();
        expect(await isOpen(redis, "nvidia")).toBe(false);
    });

    it("trips to open after 3 failures", async () => {
        const redis = createFakeRedis();

        await recordFailure(redis, "nvidia");
        expect(await isOpen(redis, "nvidia")).toBe(false);

        await recordFailure(redis, "nvidia");
        expect(await isOpen(redis, "nvidia")).toBe(false);

        await recordFailure(redis, "nvidia");
        expect(await isOpen(redis, "nvidia")).toBe(true);
    });

    it("resets failure counter on success", async () => {
        const redis = createFakeRedis();

        await recordFailure(redis, "nvidia");
        await recordFailure(redis, "nvidia");
        await recordSuccess(redis, "nvidia");

        // Needs 3 more failures now
        await recordFailure(redis, "nvidia");
        expect(await isOpen(redis, "nvidia")).toBe(false);
    });

    it("fails open if Redis throws", async () => {
        const brokenRedis: CircuitBreakerRedis = {
            incr: async () => {
                throw new Error("Redis down");
            },
            expire: async () => 1,
            set: async () => "OK",
            del: async () => 1,
            exists: async () => {
                throw new Error("Redis down");
            },
        };

        await recordFailure(brokenRedis, "nvidia");
        expect(await isOpen(brokenRedis, "nvidia")).toBe(false);
    });
});
