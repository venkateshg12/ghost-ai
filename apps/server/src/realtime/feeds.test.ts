import { describe, expect, it, vi } from "vitest";
import { AI_CHAT_FEED, AI_STATUS_FEED, chatMessagePayloadSchema } from "@repo/types";

interface Row { id: string; projectId: string; feed: string; data: unknown; createdAt: string; updatedAt?: string }

const db = vi.hoisted(() => ({ rows: [] as { id: string; projectId: string; feed: string; data: unknown; createdAt: string; updatedAt?: string }[], seq: 0 }));

vi.mock("../prisma/db", () => {
    type R = Row;
    const matching = (filter: Partial<R>) => db.rows.filter((r) => Object.entries(filter).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v));
    const query = (filter: Partial<R>) => {
        const chain = {
            orderBy: () => chain,
            select: () => chain,
            all: async () => [...matching(filter)].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
            first: async () => matching(filter)[0] ?? null,
            update: async (patch: Partial<R>) => {
                const row = matching(filter)[0];
                if (!row) return null;
                Object.assign(row, patch);
                return row;
            },
            delete: async () => {
                for (const row of matching(filter)) db.rows.splice(db.rows.indexOf(row), 1);
                return true;
            },
        };
        return chain;
    };
    return {
        orm: {
            RoomMessage: {
                where: query,
                create: async (input: Omit<R, "createdAt">) => {
                    const row = { ...input, createdAt: new Date(Date.UTC(2026, 0, 1) + db.seq++ * 1000).toISOString() };
                    db.rows.push(row);
                    return row;
                },
            },
        },
    };
});

import { RoomFeedManager } from "./feeds";
import type { Connection } from "./connection";

const ROOM = "room-1";
const conn = (userInfo: { name: string; color: string; avatar: string | null }) =>
    ({ id: "c1", userId: "real-user", userInfo }) as unknown as Connection;

const setup = () => {
    db.rows.length = 0;
    db.seq = 0;
    const broadcast = vi.fn();
    return { feeds: new RoomFeedManager(ROOM, broadcast), broadcast };
};

const userMessage = (extra: Record<string, unknown> = {}) => ({
    type: "chat",
    role: "user",
    content: "hello",
    sender: { id: "someone-else", name: "Impostor" },
    ...extra,
});

describe("RoomFeedManager: client writes", () => {
    it("replaces a forged sender with the identity from the ticket", async () => {
        const { feeds } = setup();
        const ok = await feeds.onClientFeedCreate(conn({ name: "Real", color: "#fff", avatar: "https://x/a.png" }), AI_CHAT_FEED, userMessage());

        expect(ok).toBe(true);
        const stored = db.rows[0]!.data as { sender: { id: string; name: string } };
        expect(stored.sender).toMatchObject({ id: "real-user", name: "Real" });
    });

    it("rejects role: assistant from a browser", async () => {
        const { feeds } = setup();
        const ok = await feeds.onClientFeedCreate(conn({ name: "Real", color: "#fff", avatar: null }), AI_CHAT_FEED, userMessage({ role: "assistant", sender: { id: "plano", name: "Plano" } }));
        expect(ok).toBe(false);
        expect(db.rows).toHaveLength(0);
    });

    it("rejects any feed but ai-chat", async () => {
        const { feeds } = setup();
        expect(await feeds.onClientFeedCreate(conn({ name: "R", color: "#fff", avatar: null }), AI_STATUS_FEED, userMessage())).toBe(false);
        expect(db.rows).toHaveLength(0);
    });

    it("keeps only the text: run ids, undo flags and suggestions are the server's to set", async () => {
        const { feeds } = setup();
        await feeds.onClientFeedCreate(
            conn({ name: "R", color: "#fff", avatar: null }),
            AI_CHAT_FEED,
            userMessage({ runId: "run-1", canUndo: true, suggestions: ["x"], streaming: true })
        );
        const stored = db.rows[0]!.data as Record<string, unknown>;
        expect(stored.runId).toBeUndefined();
        expect(stored.canUndo).toBeUndefined();
        expect(stored.suggestions).toBeUndefined();
        expect(stored.streaming).toBeUndefined();
    });

    it("rejects an oversized message", async () => {
        const { feeds } = setup();
        expect(await feeds.onClientFeedCreate(conn({ name: "R", color: "#fff", avatar: null }), AI_CHAT_FEED, userMessage({ content: "x".repeat(4001) }))).toBe(false);
    });

    // Regression: users without an avatar were stamped with `avatar: null`, which the shared schema rejected, so
    // their messages vanished from the chat for everyone and from the AI's history.
    it("stores a message from a user with no avatar in a shape every reader accepts", async () => {
        const { feeds } = setup();
        await feeds.onClientFeedCreate(conn({ name: "No Avatar", color: "#fff", avatar: null }), AI_CHAT_FEED, userMessage());

        expect(chatMessagePayloadSchema.safeParse(db.rows[0]!.data).success).toBe(true);
    });

    it("also accepts a null avatar if one ever reaches the schema", () => {
        const parsed = chatMessagePayloadSchema.safeParse({ type: "chat", role: "user", content: "hi", sender: { id: "u", name: "n", avatar: null } });
        expect(parsed.success).toBe(true);
    });
});

describe("RoomFeedManager: log", () => {
    it("saves before it broadcasts", async () => {
        const { feeds, broadcast } = setup();
        broadcast.mockImplementation(() => expect(db.rows).toHaveLength(1));
        await feeds.createMessage(AI_CHAT_FEED, { type: "chat" });
        expect(broadcast).toHaveBeenCalledOnce();
    });

    it("keeps only the newest 200 messages per feed", async () => {
        const { feeds } = setup();
        for (let i = 0; i < 205; i++) await feeds.createMessage(AI_CHAT_FEED, { type: "chat", n: i });
        await vi.waitFor(() => expect(db.rows.filter((r) => r.feed === AI_CHAT_FEED)).toHaveLength(200));

        const remaining = db.rows.map((r) => (r.data as { n: number }).n);
        expect(Math.min(...remaining)).toBe(5);
        expect(Math.max(...remaining)).toBe(204);
    });

    it("trims each feed on its own", async () => {
        const { feeds } = setup();
        for (let i = 0; i < 203; i++) await feeds.createMessage(AI_STATUS_FEED, { type: "status", n: i });
        await feeds.createMessage(AI_CHAT_FEED, { type: "chat" });
        await vi.waitFor(() => expect(db.rows.filter((r) => r.feed === AI_STATUS_FEED)).toHaveLength(200));
        expect(db.rows.filter((r) => r.feed === AI_CHAT_FEED)).toHaveLength(1);
    });

    it("streams a reply by updating one message, and broadcasts each update", async () => {
        const { feeds, broadcast } = setup();
        const created = await feeds.createMessage(AI_CHAT_FEED, { type: "chat", content: "He" });
        await feeds.updateMessage(AI_CHAT_FEED, created!.id, { type: "chat", content: "Hello" });

        expect(db.rows).toHaveLength(1);
        expect((db.rows[0]!.data as { content: string }).content).toBe("Hello");
        expect(broadcast.mock.calls.map((c) => c[0].t)).toEqual(["feed:create", "feed:update"]);
    });

    it("returns history oldest first, capped to the limit", async () => {
        const { feeds } = setup();
        for (let i = 0; i < 5; i++) await feeds.createMessage(AI_CHAT_FEED, { type: "chat", n: i });
        const recent = await feeds.getRecentMessages(3);
        expect(recent[AI_CHAT_FEED]!.map((m) => (m.data as { n: number }).n)).toEqual([2, 3, 4]);
    });
});
