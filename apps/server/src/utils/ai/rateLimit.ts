import type { Redis } from "ioredis";

export interface RateLimitRedis {
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<number | boolean>;
}

/**
 * Fixed-window counter in Redis for provider RPM limits.
 * Returns 0 if a slot was taken, otherwise how many ms until the next window.
 * Fails open (returns 0) if Redis encounters an error.
 */
export const takeSlot = async (
    redis: RateLimitRedis | Redis,
    provider: string,
    perMinute: number,
    now = Date.now()
): Promise<number> => {
    try {
        const window = Math.floor(now / 60_000);
        const key = `ghost:ai:rl:${provider}:${window}`;
        const count = await redis.incr(key);
        if (count === 1) await redis.expire(key, 90);
        return count <= perMinute ? 0 : (window + 1) * 60_000 - now;
    } catch (error) {
        console.warn(`[rateLimit] Redis error for provider ${provider}, failing open:`, error);
        return 0;
    }
};
