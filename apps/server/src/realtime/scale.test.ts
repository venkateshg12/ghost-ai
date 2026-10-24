import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CLOSE, toFlowGraph } from "@repo/types";
import { MemoryBusHub } from "./memoryBus";
import { RoomManager } from "./roomManager";
import { connectClient, fakeFeeds, getDocNodesMap, makeNode, nodeIds, sleep, startGateway, waitFor, writeNode, type TestStore } from "./testing";

const closers: (() => void)[] = [];
afterEach(() => {
    for (const close of closers.splice(0)) close();
});

/** Two API instances sharing one bus and one blob store, each with its own gateway. */
const twoInstances = async (overrides: { saveDebounceMs?: number } = {}) => {
    const hub = new MemoryBusHub();
    const store: TestStore = { docs: new Map(), saves: new Map() };
    const make = (name: string) => {
        const saves: string[] = [];
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
                saves.push(name);
                return { savedAt: Date.now() };
            },
            createFeeds: fakeFeeds,
            saveDebounceMs: overrides.saveDebounceMs ?? 20,
            saveMaxWaitMs: 200,
            evictAfterMs: 5_000,
        });
        return { manager, saves, name };
    };
    const a = make("A");
    const b = make("B");
    const gwA = await startGateway(a.manager);
    const gwB = await startGateway(b.manager);
    closers.push(() => void gwA.close(), () => void gwB.close());
    return { hub, store, a: { ...a, port: gwA.port }, b: { ...b, port: gwB.port }, roomId: crypto.randomUUID() };
};

describe("two instances sharing a room through the bus", () => {
    it("converge after concurrent edits made on both sides", async () => {
        const { a, b, roomId } = await twoInstances();
        const onA = await connectClient(a.port, roomId, { userId: "ua" });
        const onB = await connectClient(b.port, roomId, { userId: "ub" });
        closers.push(() => onA.close(), () => onB.close());
        await waitFor(() => onA.syncStep2 > 0 && onB.syncStep2 > 0);

        onA.update(() => {
            writeNode(getDocNodesMap(onA.doc), makeNode("from-a", 1, 1));
        });
        onB.update(() => writeNode(getDocNodesMap(onB.doc), makeNode("from-b", 2, 2)));

        await waitFor(() => nodeIds(onA.doc).length === 2 && nodeIds(onB.doc).length === 2);
        expect(nodeIds(onA.doc)).toEqual(["from-a", "from-b"]);
        expect(JSON.stringify(toFlowGraph(onA.doc))).toBe(JSON.stringify(toFlowGraph(onB.doc)));
        expect(JSON.stringify(toFlowGraph(a.manager.getRoom(roomId)!.doc))).toBe(JSON.stringify(toFlowGraph(b.manager.getRoom(roomId)!.doc)));
    });

    it("show each other's cursors, including to someone who joins late on the other instance", async () => {
        const { a, b, roomId } = await twoInstances();
        const onA = await connectClient(a.port, roomId, { userId: "ua", name: "Alice" });
        closers.push(() => onA.close());
        await waitFor(() => onA.syncStep2 > 0);
        onA.ws.send(JSON.stringify({ t: "presence", presence: { cursor: { x: 7, y: 8 }, thinking: false } }));
        await sleep(150);

        // Joins B after Alice moved: B must already know her from the bus.
        const onB = await connectClient(b.port, roomId, { userId: "ub" });
        closers.push(() => onB.close());
        await waitFor(() => onB.json.some((f) => f.t === "hello"));
        const hello = onB.json.find((f) => f.t === "hello");
        const seen = hello && hello.t === "hello" ? hello.presence : [];
        expect(seen.find((p) => p.userId === "ua")?.presence.cursor).toEqual({ x: 7, y: 8 });
    });

    it("bring an instance that opens the room late up to date with edits not yet saved", async () => {
        // Long debounce: the edit exists only in A's memory when B first opens the room.
        const { a, b, roomId } = await twoInstances({ saveDebounceMs: 60_000 });
        const onA = await connectClient(a.port, roomId, { userId: "ua" });
        closers.push(() => onA.close());
        await waitFor(() => onA.syncStep2 > 0);
        onA.update(() => writeNode(getDocNodesMap(onA.doc), makeNode("unsaved-edit")));
        await waitFor(() => getDocNodesMap(a.manager.getRoom(roomId)!.doc).has("unsaved-edit"));

        const onB = await connectClient(b.port, roomId, { userId: "ub" });
        closers.push(() => onB.close());
        await waitFor(() => onB.syncStep2 > 0);
        await waitFor(() => nodeIds(onB.doc).includes("unsaved-edit"));
    });

    it("remove a cursor on the other instance when its tab closes", async () => {
        const { a, b, roomId } = await twoInstances();
        const onA = await connectClient(a.port, roomId, { userId: "ua" });
        const onB = await connectClient(b.port, roomId, { userId: "ub" });
        closers.push(() => onB.close());
        await waitFor(() => onA.syncStep2 > 0 && onB.syncStep2 > 0);
        onA.ws.send(JSON.stringify({ t: "presence", presence: { cursor: { x: 1, y: 1 }, thinking: false } }));
        await waitFor(() => onB.json.some((f) => f.t === "presence:batch" && f.changes.some((c) => c.userId === "ua")));

        const connectionId = onB.json.flatMap((f) => (f.t === "presence:batch" ? f.changes : [])).find((c) => c.userId === "ua")!.connectionId;
        onA.close();
        await waitFor(() => onB.json.some((f) => f.t === "presence:leave" && f.connectionId === connectionId));
    });

    it("kick a removed collaborator whose socket is on the other instance", async () => {
        const { a, b, roomId } = await twoInstances();
        const victim = await connectClient(a.port, roomId, { userId: "removed-user" });
        await waitFor(() => victim.syncStep2 > 0);
        await b.manager.getOrCreateRoom(roomId); // B has the room too, as it would with its own users

        await b.manager.kickUser(roomId, "removed-user");
        await waitFor(() => victim.closeCode !== null);
        expect(victim.closeCode).toBe(CLOSE.FORBIDDEN);
    });

    it("close the room on the other instance when the project is deleted", async () => {
        const { a, b, roomId } = await twoInstances();
        const client = await connectClient(a.port, roomId);
        await waitFor(() => client.syncStep2 > 0);
        await b.manager.getOrCreateRoom(roomId);

        await b.manager.destroyRoom(roomId);
        await waitFor(() => client.closeCode !== null);
        expect(client.closeCode).toBe(CLOSE.ROOM_DELETED);
        expect(a.manager.getRoom(roomId)).toBeUndefined();
    });

    it("keep serving their own sockets while the bus is down, and reconcile when it returns", async () => {
        const { hub, a, b, roomId } = await twoInstances();
        const onA = await connectClient(a.port, roomId, { userId: "ua" });
        const onB = await connectClient(b.port, roomId, { userId: "ub" });
        closers.push(() => onA.close(), () => onB.close());
        await waitFor(() => onA.syncStep2 > 0 && onB.syncStep2 > 0);

        hub.setDown(true);
        onA.update(() => writeNode(getDocNodesMap(onA.doc), makeNode("during-outage-a")));
        onB.update(() => writeNode(getDocNodesMap(onB.doc), makeNode("during-outage-b")));
        await sleep(100);
        // Each side still sees its own edit; the other side has not heard of it.
        expect(nodeIds(onA.doc)).toEqual(["during-outage-a"]);
        expect(nodeIds(onB.doc)).toEqual(["during-outage-b"]);

        hub.setDown(false);
        await waitFor(() => nodeIds(onA.doc).length === 2 && nodeIds(onB.doc).length === 2);
        expect(nodeIds(onA.doc)).toEqual(["during-outage-a", "during-outage-b"]);
    });
});

describe("saving across instances", () => {
    it("writes the blob from one instance while the other defers to it", async () => {
        const { a, b, roomId, store } = await twoInstances({ saveDebounceMs: 20 });
        const onA = await connectClient(a.port, roomId, { userId: "ua" });
        const onB = await connectClient(b.port, roomId, { userId: "ub" });
        closers.push(() => onA.close(), () => onB.close());
        await waitFor(() => onA.syncStep2 > 0 && onB.syncStep2 > 0);

        onA.update(() => writeNode(getDocNodesMap(onA.doc), makeNode("shared")));
        await waitFor(() => store.docs.has(roomId));
        await sleep(150);

        // Both instances became dirty (A by the edit, B through the bus) but the lock lets one write.
        const writers = new Set([...a.saves, ...b.saves]);
        expect(writers.size).toBe(1);
        const saved = new Y.Doc();
        Y.applyUpdate(saved, store.docs.get(roomId)!);
        expect(nodeIds(saved)).toEqual(["shared"]);
    });
});
