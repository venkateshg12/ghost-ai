import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeTicket, issueTicket } from "./tickets";

describe("tickets", () => {
    it("issues a ticket and allows single-use consumption", async () => {
        const payload = {
            userId: "user-123",
            roomId: "room-abc",
            userInfo: {
                name: "Alice",
                avatar: null,
                color: "#ff0000",
            },
        };

        const ticket = await issueTicket(payload);
        expect(ticket).toBeDefined();
        expect(ticket.length).toBeGreaterThanOrEqual(32);

        // First consume succeeds
        const consumed = await consumeTicket(ticket);
        expect(consumed).toEqual(payload);

        // Second consume fails (single-use)
        const secondConsume = await consumeTicket(ticket);
        expect(secondConsume).toBeNull();
    });

    it("rejects an invalid, empty, or non-existent ticket", async () => {
        expect(await consumeTicket("")).toBeNull();
        expect(await consumeTicket("non-existent-random-ticket")).toBeNull();
    });
});

// Redis's SET ... EX and GETDEL, with expiry measured on the (fake) clock.
const fakeRedis = () => {
    const entries = new Map<string, { value: string; expiresAt: number }>();
    const calls: { key: string; ttl: number }[] = [];
    return {
        entries,
        calls,
        set: async (key: string, value: string, _mode: string, ttl: number) => {
            calls.push({ key, ttl });
            entries.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
            return "OK";
        },
        getdel: async (key: string) => {
            const entry = entries.get(key);
            entries.delete(key);
            return entry && entry.expiresAt > Date.now() ? entry.value : null;
        },
    };
};

const payload = { userId: "u1", roomId: "r1", userInfo: { name: "Bob", avatar: null, color: "#00f" } };

describe("tickets against Redis", () => {
    afterEach(() => vi.useRealTimers());

    it("stores only the hash of the ticket, for 60 seconds", async () => {
        const redis = fakeRedis();
        const ticket = await issueTicket(payload, redis);

        expect(redis.calls).toHaveLength(1);
        expect(redis.calls[0]!.ttl).toBe(60);
        expect(redis.calls[0]!.key.startsWith("rt:ticket:")).toBe(true);
        expect(redis.calls[0]!.key).not.toContain(ticket);
    });

    it("is single use", async () => {
        const redis = fakeRedis();
        const ticket = await issueTicket(payload, redis);
        expect(await consumeTicket(ticket, redis)).toEqual(payload);
        expect(await consumeTicket(ticket, redis)).toBeNull();
    });

    it("rejects an expired ticket", async () => {
        vi.useFakeTimers();
        const redis = fakeRedis();
        const ticket = await issueTicket(payload, redis);

        vi.advanceTimersByTime(61_000);
        expect(await consumeTicket(ticket, redis)).toBeNull();
    });

    it("still accepts a ticket just inside its lifetime", async () => {
        vi.useFakeTimers();
        const redis = fakeRedis();
        const ticket = await issueTicket(payload, redis);

        vi.advanceTimersByTime(59_000);
        expect(await consumeTicket(ticket, redis)).toEqual(payload);
    });

    it("does not let one ticket stand in for another", async () => {
        const redis = fakeRedis();
        await issueTicket(payload, redis);
        expect(await consumeTicket("a-different-ticket", redis)).toBeNull();
    });

    it("falls back to this instance's memory when Redis is unreachable, still single use and still expiring", async () => {
        vi.useFakeTimers();
        const down = { set: async () => { throw new Error("ECONNREFUSED"); } };
        const ticket = await issueTicket(payload, down as never);

        expect(await consumeTicket(ticket, down as never)).toEqual(payload);
        expect(await consumeTicket(ticket, down as never)).toBeNull();

        const late = await issueTicket(payload, down as never);
        vi.advanceTimersByTime(61_000);
        expect(await consumeTicket(late, down as never)).toBeNull();
    });
});

