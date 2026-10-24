import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { getDocNodesMap, toFlowGraph, writeNode } from "@repo/types";
import { makeNode } from "./testing";

const mocks = vi.hoisted(() => ({
    objects: new Map<string, Buffer>(),
    reads: [] as string[],
    failReadsFor: new Set<string>(),
    project: { canvasJsonPath: null as string | null },
    projectUpdates: [] as Record<string, unknown>[],
}));

vi.mock("../utils/storage", () => ({
    storagePaths: {
        roomDoc: (id: string) => `rooms/${id}.ydoc`,
        canvas: (id: string) => `canvas/${id}.json`,
    },
    referenceFor: (pathname: string) => `ref:${pathname}`,
    putBytes: async (pathname: string, content: Buffer | string) => {
        mocks.objects.set(`ref:${pathname}`, Buffer.from(content));
        return `ref:${pathname}`;
    },
    putText: async (pathname: string, content: string) => {
        mocks.objects.set(`ref:${pathname}`, Buffer.from(content));
        return `ref:${pathname}`;
    },
    readBytes: async (reference: string) => {
        mocks.reads.push(reference);
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (mocks.failReadsFor.has(reference)) throw new Error("storage unavailable");
        return mocks.objects.get(reference) ?? null;
    },
    readText: async (reference: string) => {
        mocks.reads.push(reference);
        if (mocks.failReadsFor.has(reference)) throw new Error("storage unavailable");
        return mocks.objects.get(reference)?.toString("utf8") ?? null;
    },
}));

vi.mock("../prisma/db", () => ({
    orm: {
        Project: {
            where: () => ({
                select: () => ({ first: async () => mocks.project }),
                update: async (patch: Record<string, unknown>) => {
                    mocks.projectUpdates.push(patch);
                    return {};
                },
            }),
        },
    },
}));

import { loadRoomDoc, saveRoomDoc } from "./persistence";

const ROOM = "0b7d8f0e-6f3a-4a5e-9d0e-7a6a5c2f1b11";

beforeEach(() => {
    mocks.objects.clear();
    mocks.reads.length = 0;
    mocks.failReadsFor.clear();
    mocks.project.canvasJsonPath = null;
    mocks.projectUpdates.length = 0;
});

describe("loadRoomDoc", () => {
    it("reads the .ydoc once when two joins hit a cold room at the same moment", async () => {
        const seeded = new Y.Doc();
        writeNode(getDocNodesMap(seeded), makeNode("a"));
        mocks.objects.set(`ref:rooms/${ROOM}.ydoc`, Buffer.from(Y.encodeStateAsUpdate(seeded)));

        const [first, second] = await Promise.all([loadRoomDoc(ROOM), loadRoomDoc(ROOM)]);

        expect(first).toBe(second);
        expect(mocks.reads.filter((r) => r.endsWith(".ydoc"))).toHaveLength(1);
        expect(toFlowGraph(first).nodes.map((n) => n.id)).toEqual(["a"]);
    });

    it("seeds a project that only has a JSON snapshot (the migration path)", async () => {
        mocks.project.canvasJsonPath = "ref:canvas/legacy.json";
        mocks.objects.set(
            "ref:canvas/legacy.json",
            Buffer.from(JSON.stringify({ nodes: [makeNode("old-1"), makeNode("old-2")], edges: [{ id: "e1", source: "old-1", target: "old-2", sourceHandle: "right" }] }))
        );

        const graph = toFlowGraph(await loadRoomDoc(ROOM));
        expect(graph.nodes.map((n) => n.id)).toEqual(["old-1", "old-2"]);
        expect(graph.edges).toHaveLength(1);
        expect(graph.edges[0]!.sourceHandle).toBe("right");
    });

    it("never seeds from the snapshot when a .ydoc exists (that would duplicate the diagram)", async () => {
        const saved = new Y.Doc();
        writeNode(getDocNodesMap(saved), makeNode("from-ydoc"));
        mocks.objects.set(`ref:rooms/${ROOM}.ydoc`, Buffer.from(Y.encodeStateAsUpdate(saved)));
        mocks.project.canvasJsonPath = "ref:canvas/old.json";
        mocks.objects.set("ref:canvas/old.json", Buffer.from(JSON.stringify({ nodes: [makeNode("stale-snapshot")], edges: [] })));

        const graph = toFlowGraph(await loadRoomDoc(ROOM));
        expect(graph.nodes.map((n) => n.id)).toEqual(["from-ydoc"]);
    });

    // Regression: a transient storage error used to fall through to the older snapshot (or an empty doc), and the
    // next save then overwrote the real data with it.
    it("fails the load, instead of falling back, when the .ydoc cannot be read", async () => {
        mocks.failReadsFor.add(`ref:rooms/${ROOM}.ydoc`);
        mocks.project.canvasJsonPath = "ref:canvas/old.json";
        mocks.objects.set("ref:canvas/old.json", Buffer.from(JSON.stringify({ nodes: [makeNode("stale")], edges: [] })));

        await expect(loadRoomDoc(ROOM)).rejects.toThrow("storage unavailable");
    });

    it("fails the load when the snapshot exists but cannot be read", async () => {
        mocks.project.canvasJsonPath = "ref:canvas/old.json";
        mocks.failReadsFor.add("ref:canvas/old.json");
        await expect(loadRoomDoc(ROOM)).rejects.toThrow("storage unavailable");
    });

    it("starts empty for a brand-new project", async () => {
        expect(toFlowGraph(await loadRoomDoc(ROOM)).nodes).toEqual([]);
    });
});

describe("saveRoomDoc", () => {
    it("round-trips: what was saved is what loads after a restart", async () => {
        const doc = new Y.Doc();
        writeNode(getDocNodesMap(doc), makeNode("kept", 10, 20, "My label"));
        await saveRoomDoc(ROOM, doc);

        const restarted = await loadRoomDoc(ROOM);
        const node = toFlowGraph(restarted).nodes[0]!;
        expect(node.id).toBe("kept");
        expect(node.position).toEqual({ x: 10, y: 20 });
        expect(node.data.label).toBe("My label");
    });

    it("records the reference storage returned, so readers can open it again", async () => {
        await saveRoomDoc(ROOM, new Y.Doc());
        expect(mocks.projectUpdates[0]!.canvasJsonPath).toBe(`ref:canvas/${ROOM}.json`);
        expect(mocks.objects.has(`ref:canvas/${ROOM}.json`)).toBe(true);
    });
});
