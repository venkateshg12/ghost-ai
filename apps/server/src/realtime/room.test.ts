import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { getDocNodesMap, toFlowGraph } from "@repo/types";
import { connectClient, createManager, makeNode, nodeIds, sleep, startGateway, waitFor, writeNode } from "./testing";

const closers: (() => void)[] = [];
afterEach(() => {
    for (const close of closers.splice(0)) close();
});

const boot = async (overrides: Parameters<typeof createManager>[0] = {}, store?: Parameters<typeof createManager>[1]) => {
    const env = createManager(overrides, store);
    const gw = await startGateway(env.manager);
    closers.push(() => void gw.close());
    const roomId = crypto.randomUUID();
    return { ...env, gw, roomId };
};

describe("Room persistence lifecycle", () => {
    it("saves after the debounce, and saves again for an edit made soon after (inside the lock window)", async () => {
        const { gw, roomId, store } = await boot();
        const client = await connectClient(gw.port, roomId);
        closers.push(() => client.close());
        await waitFor(() => client.syncStep2 > 0);

        client.update(() => writeNode(getDocNodesMap(client.doc), makeNode("first")));
        await waitFor(() => (store.saves.get(roomId) ?? 0) === 1);

        // Regression: this second edit used to be skipped because the first save's lock was still held by the
        // same instance, so it only reached storage after the next unrelated edit (or never).
        client.update(() => writeNode(getDocNodesMap(client.doc), makeNode("second")));
        await waitFor(() => (store.saves.get(roomId) ?? 0) === 2);

        const saved = new Y.Doc();
        Y.applyUpdate(saved, store.docs.get(roomId)!);
        expect(nodeIds(saved)).toEqual(["first", "second"]);
    });

    it("saves when the last person leaves right after an edit, and never loses it to eviction", async () => {
        const { manager, gw, roomId, store } = await boot({ saveDebounceMs: 5_000, saveMaxWaitMs: 10_000, evictAfterMs: 40 });
        const client = await connectClient(gw.port, roomId);
        await waitFor(() => client.syncStep2 > 0);

        client.update(() => writeNode(getDocNodesMap(client.doc), makeNode("last-edit")));
        await waitFor(() => getDocNodesMap(manager.getRoom(roomId)!.doc).has("last-edit"));
        client.close();

        await waitFor(() => store.docs.has(roomId));
        await waitFor(() => manager.getRoom(roomId) === undefined); // evicted, after the save

        const reloaded = await manager.getOrCreateRoom(roomId);
        expect(nodeIds(reloaded.doc)).toEqual(["last-edit"]);
    });

    it("keeps the room in memory when someone rejoins before the eviction timer", async () => {
        const { manager, gw, roomId } = await boot({ evictAfterMs: 150 });
        const first = await connectClient(gw.port, roomId);
        await waitFor(() => first.syncStep2 > 0);
        const room = manager.getRoom(roomId)!;
        first.close();
        await sleep(30);

        const second = await connectClient(gw.port, roomId, { userId: "u2" });
        closers.push(() => second.close());
        await sleep(250);
        expect(manager.getRoom(roomId)).toBe(room);
        expect(room.destroyed).toBe(false);
    });

    it("retries a failed save and tells the room", async () => {
        let attempts = 0;
        const { gw, roomId } = await boot({
            saveDebounceMs: 10,
            save: async () => {
                if (++attempts === 1) throw new Error("blob store is down");
                return { savedAt: Date.now() };
            },
        });
        const client = await connectClient(gw.port, roomId);
        closers.push(() => client.close());
        await waitFor(() => client.syncStep2 > 0);

        client.update(() => writeNode(getDocNodesMap(client.doc), makeNode("n")));
        await waitFor(() => client.json.some((f) => f.t === "error"));
        // The retry is scheduled a few seconds out; trigger it through an explicit save instead of waiting.
        client.ws.send(JSON.stringify({ t: "flush" }));
        await waitFor(() => client.json.some((f) => f.t === "saved"));
        expect(attempts).toBe(2);
    });

    it("answers an explicit save with a `saved` frame even when nothing changed", async () => {
        const { gw, roomId } = await boot();
        const client = await connectClient(gw.port, roomId);
        closers.push(() => client.close());
        await waitFor(() => client.syncStep2 > 0);

        client.ws.send(JSON.stringify({ t: "flush" }));
        await waitFor(() => client.json.some((f) => f.t === "saved"));
    });

    it("an edit made while a save is running is still saved afterwards", async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        const saves: string[][] = [];
        const { gw, roomId } = await boot({
            saveDebounceMs: 10,
            save: async (_id, doc) => {
                if (saves.length === 0) await gate;
                saves.push(nodeIds(doc));
                return { savedAt: Date.now() };
            },
        });
        const client = await connectClient(gw.port, roomId);
        closers.push(() => client.close());
        await waitFor(() => client.syncStep2 > 0);

        client.update(() => writeNode(getDocNodesMap(client.doc), makeNode("a")));
        await sleep(60); // first save is now blocked in the gate
        client.update(() => writeNode(getDocNodesMap(client.doc), makeNode("b")));
        await sleep(60);
        release();

        await waitFor(() => saves.length === 2);
        expect(saves[1]).toEqual(["a", "b"]);
    });
});

describe("Room feeds and history on join", () => {
    it("sends recent feed history in hello", async () => {
        const history = { "ai-chat": [{ id: "m1", data: { type: "chat", content: "earlier" }, createdAt: 1 }] };
        const { gw, roomId } = await boot({
            createFeeds: () => ({
                getRecentMessages: async () => history,
                listFeedMessages: async () => [],
                createMessage: async () => null,
                updateMessage: async () => null,
                onClientFeedCreate: async () => false,
            }),
        });
        const client = await connectClient(gw.port, roomId);
        closers.push(() => client.close());
        await waitFor(() => client.json.some((f) => f.t === "hello"));
        const hello = client.json.find((f) => f.t === "hello");
        expect(hello && hello.t === "hello" ? hello.messages : null).toEqual(history);
    });
});

describe("AI edits merge with people's edits (editFlow semantics)", () => {
    it("a human edit made between the task's GET and POST survives", async () => {
        const { createMutableFlow } = await import("../utils/ai/flow");
        const room = new Y.Doc();
        writeNode(getDocNodesMap(room), makeNode("existing", 0, 0, "original label"));

        // The task fetches the state...
        const taskDoc = new Y.Doc();
        Y.applyUpdate(taskDoc, Y.encodeStateAsUpdate(room));
        const before = Y.encodeStateVector(taskDoc);

        // ...a person edits and moves the same node while the model is thinking...
        room.transact(() => {
            const node = getDocNodesMap(room).get("existing")!;
            (node.get("data") as Y.Map<unknown>).set("label", "human label");
        });
        room.transact(() => getDocNodesMap(room).get("existing")!.set("position", { x: 300, y: 300 }));

        // ...then the task adds nodes and posts only its diff.
        const flow = createMutableFlow(taskDoc);
        flow.addNode(makeNode("ai-1", 50, 50) as never);
        flow.addNode(makeNode("ai-2", 90, 90) as never);
        Y.applyUpdate(room, Y.encodeStateAsUpdate(taskDoc, before), "ai");

        const graph = toFlowGraph(room);
        expect(graph.nodes.map((n) => n.id)).toEqual(["ai-1", "ai-2", "existing"]);
        const existing = graph.nodes.find((n) => n.id === "existing")!;
        expect(existing.data.label).toBe("human label");
        expect(existing.position).toEqual({ x: 300, y: 300 });
    });

    it("an empty diff is 2 bytes, which the caller must not post", () => {
        const doc = new Y.Doc();
        writeNode(getDocNodesMap(doc), makeNode("a"));
        const diff = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(doc));
        expect(diff.byteLength).toBeLessThanOrEqual(2);
    });
});
