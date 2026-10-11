import type { Redis } from "ioredis";

export interface CircuitBreakerRedis {
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<number | boolean>;
    set: (key: string, value: string, mode?: string, duration?: number) => Promise<unknown>;
    del: (key: string) => Promise<number>;
    exists: (key: string) => Promise<number>;
}

/**
 * Records a provider failure in Redis. After 3 failures within 2 minutes,
 * trips the circuit breaker to OPEN for 5 minutes (300 seconds).
 */
export const recordFailure = async (redis: CircuitBreakerRedis | Redis, provider: string): Promise<void> => {
    try {
        const key = `ghost:ai:cb:${provider}:fails`;
        const fails = await redis.incr(key);
        if (fails === 1) await redis.expire(key, 120);
        if (fails >= 3) {
            await redis.set(`ghost:ai:cb:${provider}:open`, "1", "EX", 300);
        }
    } catch (error) {
        console.warn(`[circuitBreaker] Redis error recording failure for ${provider}:`, error);
    }
};

/**
 * Resets the failure counter for a provider upon success.
 */
export const recordSuccess = async (redis: CircuitBreakerRedis | Redis, provider: string): Promise<void> => {
    try {
        await redis.del(`ghost:ai:cb:${provider}:fails`);
    } catch (error) {
        console.warn(`[circuitBreaker] Redis error recording success for ${provider}:`, error);
    }
};

/**
 * Checks whether the circuit for a provider is currently open (failing).
 * Fails open (returns false) if Redis throws.
 */
export const isOpen = async (redis: CircuitBreakerRedis | Redis, provider: string): Promise<boolean> => {
    try {
        return (await redis.exists(`ghost:ai:cb:${provider}:open`)) === 1;
    } catch (error) {
        console.warn(`[circuitBreaker] Redis error checking status for ${provider}:`, error);
        return false;
    }
};
