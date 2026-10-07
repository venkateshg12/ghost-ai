import Redis from "ioredis";
import { getCacheRedisConfig } from "../../config/redis";
import { CACHE_ENABLED } from "../../constants/env";
import { RedisCircuitBreaker } from "../ratelimiter/circuitBreaker";

/*
  Cache-aside over a dedicated Redis. Nothing here ever throws: every failure — Redis down, slow,
  or switched off — degrades to "cache miss", and the caller reads Postgres as it would without a
  cache. The circuit breaker (shared implementation with the rate limiter) stops a hung Redis from
  adding its timeout to every request: after repeated failures calls skip Redis entirely until a
  probe succeeds.

  Invalidation is by versioned namespace, not by deleting keys. Each domain has a counter; every key
  embeds the current counter of each domain its data came from; a write bumps the counter, so old
  keys are simply never read again and age out through their TTL. That is O(1) however many keys a
  domain has, and it closes the race where a slow request that read old data writes it back after an
  invalidation — it writes under the old version, which nobody reads any more.
 */

/*
  `members` holds the enriched owner/collaborator list a share dialog reads. Any invite, removal or
  profile change bumps it.
 */
export type CacheDomain = "members";

const enabled = CACHE_ENABLED !== "false";

const breaker = new RedisCircuitBreaker({}, (from, to) => {
    console.warn(`[Cache] Redis circuit ${from} -> ${to}`);
});

// Created on first use, so a script that imports a service doesn't open a connection it never uses.
let client: Redis | null = null;

const getClient = (): Redis => {
    if (!client) {
        client = new Redis(getCacheRedisConfig());
        /*
          Without a listener ioredis reports every reconnect failure as an unhandled error. They
          aren't fed to the breaker: while disconnected `run` already skips Redis, and counting each
          reconnect attempt would leave the breaker open for its full reset window after Redis came
          back. Logged once per outage rather than once per attempt.
         */
        let reportedOutage = false;
        client.on("error", (error) => {
            if (!reportedOutage) console.warn(`[Cache] Redis unavailable, serving from Postgres: ${error.message}`);
            reportedOutage = true;
        });
        client.on("ready", () => {
            if (reportedOutage) console.warn("[Cache] Redis reconnected");
            reportedOutage = false;
        });
    }
    return client;
};

/*
  While the client isn't connected (still starting, or reconnecting after an outage) the call is a
  plain miss: it neither waits nor counts as a failure. Otherwise a burst of requests at boot, sent
  before the first connection completes, would each fail and trip the breaker, switching the cache
  off for its whole reset window. The breaker is left to what it's for — a connected Redis that is
  slow or erroring.
 */
const run = async <T>(operation: (redis: Redis) => Promise<T>, fallback: T): Promise<T> => {
    if (!enabled) return fallback;
    const redis = getClient();
    if (redis.status !== "ready") return fallback;
    return breaker.execute(() => operation(redis), async () => fallback);
};

const versionKey = (domain: CacheDomain) => `cache:ver:${domain}`;

// Concurrent misses on one key share a single fetch, so an expired hot key costs one Postgres query
// rather than one per request in flight. Per process, which is all it needs to be.
const inflight = new Map<string, Promise<unknown>>();

const get = (key: string) => run((redis) => redis.get(key), null);

// Every entry gets a TTL: the cache instance evicts with `volatile-lru`, which only considers keys
// that have one.
const set = (key: string, value: string, ttlSeconds: number) =>
    run((redis) => redis.set(key, value, "EX", ttlSeconds), null);

const del = (...keys: string[]) =>
    keys.length === 0 ? Promise.resolve(0) : run((redis) => redis.del(...keys), 0);

/*
  The key for data drawn from `domains`, stamped with each domain's current version — or `null` when
  the versions can't be read, in which case `getOrSet` skips the cache for this request.
 */
const versionedKey = async (domains: CacheDomain[], suffix: string): Promise<string | null> => {
    const versions = await run((redis) => redis.mget(...domains.map(versionKey)), null);
    if (!versions) return null;
    const stamp = domains.map((domain, index) => `${domain}.${versions[index] ?? "0"}`).join(":");
    return `cache:${stamp}:${suffix}`;
};

/*
  Invalidates everything cached from these domains. Called after the Postgres write has succeeded. If
  Redis is unreachable the bump is lost and stale entries live out their TTL — every TTL is chosen
  with that bound in mind.
 */
const bump = async (...domains: CacheDomain[]): Promise<void> => {
    await run(async (redis) => {
        const pipeline = redis.multi();
        for (const domain of domains) pipeline.incr(versionKey(domain));
        return pipeline.exec();
    }, null);
};

/*
  Returns the cached value for `key`, or runs `fetcher`, caches its result and returns it. The result
  is serialised once and both paths return the parsed JSON, so a response is byte-for-byte the same
  whether it was a hit or a miss — callers get plain objects, never live query results. A `null` key
  (cache unavailable) just runs the fetcher. `null`/`undefined` results are not cached, and neither
  is a fetcher that throws.
 */
const getOrSet = async <T>(
    key: string | null,
    fetcher: () => Promise<T>,
    ttlSeconds: number | ((value: T) => number)
): Promise<T> => {
    if (!key) return fetcher();

    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;

    const load = (async () => {
        const cached = await get(key);
        if (cached !== null) return JSON.parse(cached) as T;

        const value = await fetcher();
        if (value === null || value === undefined) return value;

        const serialized = JSON.stringify(value);
        const ttl = typeof ttlSeconds === "function" ? ttlSeconds(value) : ttlSeconds;
        if (ttl > 0) {
            // Not awaited: the response doesn't wait on the write.
            void set(key, serialized, Math.ceil(ttl));
        }
        return JSON.parse(serialized) as T;
    })();

    inflight.set(key, load);
    try {
        return await load;
    } finally {
        inflight.delete(key);
    }
};

/** For the health endpoint: is the cache actually answering? Never throws. */
const ping = async (): Promise<boolean> => {
    const reply = await run((redis) => redis.ping(), null);
    return reply === "PONG";
};

/** Closes the connection during shutdown. No-op if one was never opened. */
const close = async (): Promise<void> => {
    if (!client) return;
    try {
        await client.quit();
    } catch {
        client.disconnect();
    }
    client = null;
};

export const cache = { get, set, del, getOrSet, versionedKey, bump, ping, close };

// "This session exists and hasn't expired", as last confirmed against Postgres. See `authenticate`.
export const sessionCacheKey = (sessionId: unknown) => `cache:session:${String(sessionId)}`;

