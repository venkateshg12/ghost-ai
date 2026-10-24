import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import * as Y from "yjs";

const fakeRoom = vi.hoisted(() => ({
    doc: undefined as unknown as import("yjs").Doc,
    created: [] as unknown[],
    presence: [] as unknown[],
}));

vi.mock("../realtime/roomManager", () => ({
    roomManager: {
        getOrCreateRoom: async () => ({
            doc: fakeRoom.doc,
            feeds: {
                listFeedMessages: async () => [],
                createMessage: async (feed: string, data: unknown) => {
                    fakeRoom.created.push({ feed, data });
                    return { id: "11111111-1111-4111-8111-111111111111", data, createdAt: 1 };
                },
                updateMessage: async () => null,
            },
            presence: { setAiPresence: (p: unknown, ttl: unknown) => fakeRoom.presence.push({ p, ttl }) },
        }),
    },
}));

import { internalRoutes } from "./internal.route";

const SECRET = "test-internal-secret-0123456789-abcdef";
const ROOM = "0b7d8f0e-6f3a-4a5e-9d0e-7a6a5c2f1b11";
let server: Server;
let base = "";

beforeAll(async () => {
    fakeRoom.doc = new Y.Doc();
    const app = express();
    app.use("/internal", internalRoutes);
    await new Promise<void>((resolve) => {
        server = app.listen(0, "127.0.0.1", () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const call = (path: string, init: RequestInit & { auth?: string | null } = {}) => {
    const { auth = SECRET, ...rest } = init;
    return fetch(`${base}/internal/rooms${path}`, {
        ...rest,
        headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(rest.headers as Record<string, string>) },
    });
};
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("internal room routes", () => {
    it("refuse a request with no secret or the wrong one", async () => {
        expect((await call(`/${ROOM}/state`, { auth: null })).status).toBe(401);
        expect((await call(`/${ROOM}/state`, { auth: "wrong-secret-wrong-secret-wrong-secret" })).status).toBe(401);
    });

    it("serve the document state as binary", async () => {
        const res = await call(`/${ROOM}/state`);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/octet-stream");
    });

    it("refuse a room id that is not a uuid", async () => {
        expect((await call(`/not-a-uuid/state`)).status).toBe(400);
    });

    it("apply a Yjs diff and ignore an empty one", async () => {
        const task = new Y.Doc();
        task.getMap("nodes").set("from-task", "x");
        const diff = Y.encodeStateAsUpdate(task);

        const applied = await call(`/${ROOM}/update`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.from(diff) });
        expect(applied.status).toBe(200);
        expect(fakeRoom.doc.getMap("nodes").get("from-task")).toBe("x");

        const empty = await call(`/${ROOM}/update`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.from([0, 0]) });
        expect(empty.status).toBe(200);
    });

    it("refuse a malformed Yjs update instead of crashing", async () => {
        const res = await call(`/${ROOM}/update`, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: Buffer.from([255, 255, 255, 255, 1, 2, 3]) });
        expect(res.status).toBe(400);
    });

    it("accept a message on a known feed and refuse an unknown one", async () => {
        const good = await call(`/${ROOM}/messages`, json({ feed: "ai-status-feed", data: { type: "status" } }));
        expect(good.status).toBe(200);
        expect(fakeRoom.created).toHaveLength(1);

        expect((await call(`/${ROOM}/messages`, json({ feed: "secret-feed", data: {} }))).status).toBe(400);
        expect((await call(`/${ROOM}/messages`, json({ feed: "ai-chat", data: "not an object" }))).status).toBe(400);
        expect((await call(`/${ROOM}/messages?feed=nope`)).status).toBe(400);
    });

    it("validate presence and cap its TTL", async () => {
        expect((await call(`/${ROOM}/presence`, json({ thinking: true, cursor: null, ttl: 120 }))).status).toBe(200);
        expect((await call(`/${ROOM}/presence`, json({ thinking: true, ttl: 100000 }))).status).toBe(400);
        expect((await call(`/${ROOM}/presence`, json({ cursor: "nowhere" }))).status).toBe(400);
    });
});
