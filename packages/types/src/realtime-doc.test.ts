import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { getDocEdgesMap, getDocNodesMap, isValidDocEntry, toFlowGraph, writeEdge, writeNode, type DocNode } from "./realtime-doc";

const node = (id: string, overrides: Partial<DocNode> = {}): DocNode =>
    ({
        id,
        type: "canvasNode",
        position: { x: 1, y: 2 },
        data: { label: id, color: "#000", textColor: "#fff", shape: "rectangle" },
        ...overrides,
    }) as DocNode;

describe("edges keep the handle they were drawn from and to", () => {
    it("round-trips sourceHandle and targetHandle", () => {
        const doc = new Y.Doc();
        writeEdge(getDocEdgesMap(doc), { id: "e1", type: "canvasEdge", source: "a", target: "b", sourceHandle: "right", targetHandle: "left" });

        const edge = toFlowGraph(doc).edges[0]!;
        expect(edge.sourceHandle).toBe("right");
        expect(edge.targetHandle).toBe("left");
    });

    it("omits handles that were never set (no undefined stored in the document)", () => {
        const doc = new Y.Doc();
        writeEdge(getDocEdgesMap(doc), { id: "e1", type: "canvasEdge", source: "a", target: "b", sourceHandle: null });

        const edge = toFlowGraph(doc).edges[0]!;
        expect("sourceHandle" in edge).toBe(false);
        expect(getDocEdgesMap(doc).get("e1")!.has("sourceHandle")).toBe(false);
    });
});

describe("writeNode skipPosition", () => {
    it("leaves a teammate's concurrent move in place when only the content changed", () => {
        const doc = new Y.Doc();
        const nodes = getDocNodesMap(doc);
        writeNode(nodes, node("n", { position: { x: 0, y: 0 } }));

        nodes.get("n")!.set("position", { x: 500, y: 500 }); // a teammate moved it
        writeNode(nodes, node("n", { position: { x: 0, y: 0 }, data: { label: "renamed", color: "#000", textColor: "#fff", shape: "rectangle" } }), {
            skipPosition: true,
        });

        const result = toFlowGraph(doc).nodes[0]!;
        expect(result.position).toEqual({ x: 500, y: 500 });
        expect(result.data.label).toBe("renamed");
    });

    it("still writes the position of a node that does not exist yet", () => {
        const doc = new Y.Doc();
        writeNode(getDocNodesMap(doc), node("new", { position: { x: 7, y: 8 } }), { skipPosition: true });
        expect(toFlowGraph(doc).nodes[0]!.position).toEqual({ x: 7, y: 8 });
    });
});

describe("isValidDocEntry", () => {
    const entryOf = (build: (doc: Y.Doc) => void, kind: "node" | "edge", key: string) => {
        const doc = new Y.Doc();
        build(doc);
        return isValidDocEntry(kind, key, (kind === "node" ? getDocNodesMap(doc) : getDocEdgesMap(doc)).get(key));
    };

    it("accepts what the editor writes", () => {
        expect(entryOf((d) => writeNode(getDocNodesMap(d), node("ok")), "node", "ok")).toBe(true);
        expect(entryOf((d) => writeEdge(getDocEdgesMap(d), { id: "e", type: "canvasEdge", source: "a", target: "b" }), "edge", "e")).toBe(true);
    });

    it("treats a missing entry (a delete) as valid", () => {
        expect(isValidDocEntry("node", "gone", undefined)).toBe(true);
    });

    it("rejects an entry that is not a map", () => {
        expect(isValidDocEntry("node", "x", { id: "x" })).toBe(false);
    });

    it.each([
        ["a position far outside any canvas", node("n", { position: { x: 1e12, y: 0 } })],
        ["a non-finite position", node("n", { position: { x: Number.NaN, y: 0 } })],
        ["an enormous label", node("n", { data: { label: "x".repeat(25_000), color: "", textColor: "", shape: "rectangle" } })],
    ])("rejects %s", (_name, bad) => {
        expect(entryOf((d) => writeNode(getDocNodesMap(d), bad), "node", "n")).toBe(false);
    });

    it("rejects an entry whose id does not match its key", () => {
        const doc = new Y.Doc();
        const impostor = new Y.Map<unknown>();
        getDocNodesMap(doc).set("other-key", impostor);
        impostor.set("id", "real-id");
        impostor.set("type", "canvasNode");
        impostor.set("position", { x: 0, y: 0 });
        impostor.set("data", new Y.Map());
        expect(isValidDocEntry("node", "other-key", getDocNodesMap(doc).get("other-key"))).toBe(false);
    });

    it("rejects an edge without a source or target", () => {
        expect(entryOf((d) => writeEdge(getDocEdgesMap(d), { id: "e", type: "canvasEdge", source: "", target: "b" }), "edge", "e")).toBe(false);
    });
});
