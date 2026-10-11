import { describe, expect, it } from "vitest";
import { takeSlot, type RateLimitRedis } from "./rateLimit";

const createFakeRedis = (): RateLimitRedis => {
    const store = new Map<string, number>();
    return {
        incr: async (key: string) => {
            const current = (store.get(key) ?? 0) + 1;
            store.set(key, current);
            return current;
        },
        expire: async () => 1,
    };
};

describe("takeSlot", () => {
    it("returns 0 for the first perMinute calls within the window", async () => {
        const redis = createFakeRedis();
        const now = 1_700_000_000_000;
        const limit = 5;

        for (let i = 0; i < limit; i++) {
            const wait = await takeSlot(redis, "nvidia", limit, now);
            expect(wait).toBe(0);
        }
    });

    it("returns positive wait time when limit is exceeded", async () => {
        const redis = createFakeRedis();
        const now = 60_000 + 10_000; // window 1, 10s into window
        const limit = 2;

        expect(await takeSlot(redis, "nvidia", limit, now)).toBe(0);
        expect(await takeSlot(redis, "nvidia", limit, now)).toBe(0);

        const wait = await takeSlot(redis, "nvidia", limit, now);
        expect(wait).toBe(50_000); // 50 seconds remaining until window 2
    });

    it("resets in a new window", async () => {
        const redis = createFakeRedis();
        const window1 = 60_000;
        const window2 = 120_000;
        const limit = 1;

        expect(await takeSlot(redis, "nvidia", limit, window1)).toBe(0);
        expect(await takeSlot(redis, "nvidia", limit, window1)).toBe(60_000);

        // Next window resets
        expect(await takeSlot(redis, "nvidia", limit, window2)).toBe(0);
    });

    it("fails open when Redis throws", async () => {
        const brokenRedis: RateLimitRedis = {
            incr: async () => {
                throw new Error("Redis connection refused");
            },
            expire: async () => 1,
        };

        const wait = await takeSlot(brokenRedis, "nvidia", 10);
        expect(wait).toBe(0);
    });
});
