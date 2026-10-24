import crypto from "node:crypto";
import { REALTIME_LIMITS, type RealtimeUserInfo } from "@repo/types";
import { getAiRedis } from "../utils/redis";

export interface TicketPayload {
    userId: string;
    roomId: string;
    userInfo: RealtimeUserInfo;
}

export interface TicketStore {
    set(key: string, value: string, mode: string, duration: number): Promise<unknown>;
    call?(command: string, ...args: any[]): Promise<any>;
    get?(key: string): Promise<string | null>;
    del?(key: string): Promise<number>;
    getdel?(key: string): Promise<string | null>;
}

const hashTicket = (ticket: string): string => {
    return crypto.createHash("sha256").update(ticket).digest("hex");
};

// In-memory fallback if Redis is unavailable
const memoryFallback = new Map<string, { payload: TicketPayload; expiresAt: number }>();

/**
 * Issues a single-use ticket stored under sha256(ticket) in Redis with 60s TTL.
 */
export const issueTicket = async (
    payload: TicketPayload,
    client: TicketStore = getAiRedis()
): Promise<string> => {
    const rawTicket = crypto.randomBytes(32).toString("base64url");
    const key = `rt:ticket:${hashTicket(rawTicket)}`;

    try {
        await client.set(key, JSON.stringify(payload), "EX", REALTIME_LIMITS.ticketTtlSeconds);
    } catch {
        // Redis is unreachable: this instance can still honour its own tickets.
        const now = Date.now();
        for (const [k, v] of memoryFallback) if (v.expiresAt <= now) memoryFallback.delete(k);
        memoryFallback.set(key, {
            payload,
            expiresAt: Date.now() + REALTIME_LIMITS.ticketTtlSeconds * 1000,
        });
    }

    return rawTicket;
};

/**
 * Consumes a ticket via GETDEL so it can only ever be used once.
 * Returns the payload, or null if invalid or expired.
 */
export const consumeTicket = async (
    ticket: string,
    client: TicketStore = getAiRedis()
): Promise<TicketPayload | null> => {
    if (!ticket || typeof ticket !== "string") return null;

    const key = `rt:ticket:${hashTicket(ticket)}`;

    // 1. Check in-memory store if present
    const memEntry = memoryFallback.get(key);
    if (memEntry) {
        memoryFallback.delete(key);
        if (memEntry.expiresAt > Date.now()) {
            return memEntry.payload;
        }
        return null;
    }

    // 2. Query Redis
    try {
        let raw: string | null = null;
        if (typeof client.getdel === "function") {
            raw = await client.getdel(key);
        } else if (typeof client.call === "function") {
            raw = (await client.call("GETDEL", key)) as string | null;
        }

        if (raw) return JSON.parse(raw) as TicketPayload;

        if (typeof client.get === "function" && typeof client.del === "function") {
            const fallbackRaw = await client.get(key);
            if (fallbackRaw) {
                await client.del(key);
                return JSON.parse(fallbackRaw) as TicketPayload;
            }
        }

        return null;
    } catch {
        // Redis connection error or offline
        return null;
    }
};
