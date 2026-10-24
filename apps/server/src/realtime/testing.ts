/*
  Test helpers: a real gateway and real WebSocket clients over in-memory persistence, feeds and bus, so tests
  exercise the actual protocol without Redis, Postgres or blob storage.
 */
import { createServer, type Server } from "node:http";
import { WebSocket } from "ws";
import * as Y from "yjs";
import {
    FRAME,
    decodeBinaryFrame,
    encodeBinaryFrame,
    getDocNodesMap,
    writeNode,
    type DocNode,
    type ServerFrame,
} from "@repo/types";
import { attachRealtime } from "./gateway";
import { RoomManager, type RoomManagerDeps } from "./roomManager";
import { issueTicket } from "./tickets";
import { MemoryBusHub } from "./memoryBus";
import type { RoomFeeds } from "./feeds";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitFor = async (predicate: () => boolean, timeoutMs = 2000, intervalMs = 10) => {
    const start = Date.now();
    while (!predicate()) {
        if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
        await sleep(intervalMs);
    }
};

export const makeNode = (id: string, x = 0, y = 0, label = id): DocNode =>
    ({
        id,
        type: "canvasNode",
        position: { x, y },
        data: { label, color: "#1F1F1F", textColor: "#EDEDED", shape: "rectangle" },
    }) as DocNode;

export const fakeFeeds = (): RoomFeeds => ({
    getRecentMessages: async () => ({}),
    listFeedMessages: async () => [],
    createMessage: async () => null,
    updateMessage: async () => null,
    onClientFeedCreate: async () => false,
});

export interface TestStore {
    docs: Map<string, Uint8Array>;
    saves: Map<string, number>;
}

export const createManager = (overrides: Partial<RoomManagerDeps> = {}, store: TestStore = { docs: new Map(), saves: new Map() }) => {
    const hub = new MemoryBusHub();
    const manager = new RoomManager({
        bus: hub.createBus(),
        load: async (roomId) => {
            const doc = new Y.Doc();
            const saved = store.docs.get(roomId);
            if (saved) Y.applyUpdate(doc, saved);
            return doc;
        },
        save: async (roomId, doc) => {
            store.docs.set(roomId, Y.encodeStateAsUpdate(doc));
            store.saves.set(roomId, (store.saves.get(roomId) ?? 0) + 1);
            return { savedAt: Date.now() };
        },
        createFeeds: fakeFeeds,
        evictAfterMs: 60,
        saveDebounceMs: 30,
        saveMaxWaitMs: 200,
        ...overrides,
    });
    return { manager, hub, store };
};

export const startGateway = async (manager: RoomManager) => {
    const server: Server = createServer();
    attachRealtime(server, manager);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;
    return {
        server,
        port,
        close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
};

const failingStore = {
    set: async () => {
        throw new Error("no redis in tests");
    },
};

export interface TestClient {
    ws: WebSocket;
    doc: Y.Doc;
    frames: string[];
    json: ServerFrame[];
    closeCode: number | null;
    syncStep2: number;
    send: (bytes: Uint8Array) => void;
    update: (fn: () => void) => void;
    close: () => void;
}

/** Connects like the browser does: sends SYNC_STEP1 the instant the socket opens, answers the server's SYNC_STEP1. */
export const connectClient = async (
    port: number,
    roomId: string,
    opts: { userId?: string; name?: string; origin?: string | null; userInfo?: Record<string, unknown>; doc?: Y.Doc } = {}
): Promise<TestClient> => {
    const ticket = await issueTicket(
        {
            userId: opts.userId ?? "user-1",
            roomId,
            userInfo: { name: opts.name ?? "Tester", color: "#3b82f6", avatar: null, ...opts.userInfo },
        },
        failingStore as never
    );

    const headers: Record<string, string> = {};
    if (opts.origin !== null) headers.Origin = opts.origin ?? "http://localhost:3000";
    const ws = new WebSocket(`ws://127.0.0.1:${port}/realtime?ticket=${ticket}`, { headers });

    const doc = opts.doc ?? new Y.Doc();
    const client: TestClient = {
        ws,
        doc,
        frames: [],
        json: [],
        closeCode: null,
        syncStep2: 0,
        send: (bytes) => ws.send(bytes),
        update: (fn) => doc.transact(fn, "local"),
        close: () => ws.close(),
    };

    ws.on("close", (code) => {
        client.closeCode = code;
    });
    ws.on("message", (data: Buffer, isBinary: boolean) => {
        if (!isBinary) {
            const frame = JSON.parse(data.toString()) as ServerFrame;
            client.json.push(frame);
            client.frames.push(`json:${frame.t}`);
            return;
        }
        const { type, payload } = decodeBinaryFrame(new Uint8Array(data));
        client.frames.push(`bin:${type}`);
        if (type === FRAME.SYNC_STEP1) ws.send(encodeBinaryFrame(FRAME.SYNC_STEP2, Y.encodeStateAsUpdate(doc, payload)));
        else {
            if (type === FRAME.SYNC_STEP2) client.syncStep2++;
            Y.applyUpdate(doc, payload, "remote");
        }
    });
    doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin !== "remote" && ws.readyState === WebSocket.OPEN) ws.send(encodeBinaryFrame(FRAME.UPDATE, update));
    });

    await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
            ws.send(encodeBinaryFrame(FRAME.SYNC_STEP1, Y.encodeStateVector(doc)));
            resolve();
        });
        ws.on("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
        ws.on("error", reject);
    });
    return client;
};

export const nodeIds = (doc: Y.Doc) => Array.from(getDocNodesMap(doc).keys()).sort();
export { FRAME, encodeBinaryFrame, writeNode, getDocNodesMap };
