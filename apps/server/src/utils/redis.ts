import Redis from "ioredis";
import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USERNAME } from "../constants/env";

let aiRedisClient: Redis | null = null;

/**
 * Lazy shared Redis client for AI rate limiting, circuit breaker, and response caching.
 * Designed to fail open and never queue indefinitely when Redis is offline.
 */
export const getAiRedis = (): Redis => {
    if (!aiRedisClient) {
        aiRedisClient = new Redis({
            host: REDIS_HOST,
            port: Number(REDIS_PORT),
            username: REDIS_USERNAME || undefined,
            password: REDIS_PASSWORD || undefined,
            connectTimeout: 2000,
            commandTimeout: 500,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            enableReadyCheck: false,
            lazyConnect: true,
        });

        aiRedisClient.on("error", (error) => {
            // Fail open: log the warning and let calls handle Redis downtime gracefully
            console.warn("[redis:ai]", error.message);
        });
    }

    return aiRedisClient;
};
