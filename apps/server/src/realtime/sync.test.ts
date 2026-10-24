import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
    getDocNodesMap,
    toFlowGraph,
    writeNode,
    writeNodeData,
    writeNodePosition,
    type DocNode,
} from "@repo/types";
import { createMutableFlow } from "../utils/ai/flow";

describe("Realtime CRDT Document Sync", () => {
    it("converges to identical state after bidirectional sync", () => {
        const docA = new Y.Doc();
        const docB = new Y.Doc();

        const nodeA: DocNode = {
            id: "node-1",
            type: "canvasNode",
            position: { x: 100, y: 100 },
            data: { label: "Node A", color: "#000", textColor: "#fff", shape: "rectangle" },
        };
        const nodeB: DocNode = {
            id: "node-2",
            type: "canvasNode",
            position: { x: 300, y: 200 },
            data: { label: "Node B", color: "#000", textColor: "#fff", shape: "circle" },
        };

        // User A adds nodeA
        writeNode(getDocNodesMap(docA), nodeA);

        // User B adds nodeB
        writeNode(getDocNodesMap(docB), nodeB);

        // Exchange updates
        const updateA = Y.encodeStateAsUpdate(docA);
        const updateB = Y.encodeStateAsUpdate(docB);

        Y.applyUpdate(docA, updateB);
        Y.applyUpdate(docB, updateA);

        const graphA = toFlowGraph(docA);
        const graphB = toFlowGraph(docB);

        expect(graphA.nodes.length).toBe(2);
        expect(graphB.nodes.length).toBe(2);
        expect(graphA).toEqual(graphB);
    });

    it("survives concurrent move and label edit of the same node without losing either", () => {
        const docA = new Y.Doc();
        const docB = new Y.Doc();

        const initialNode: DocNode = {
            id: "shared-node",
            type: "canvasNode",
            position: { x: 50, y: 50 },
            data: { label: "Initial Label", color: "#111", textColor: "#eee", shape: "rectangle" },
        };

        // Initial state seeded in docA, synced to docB
        writeNode(getDocNodesMap(docA), initialNode);
        Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

        // Concurrently:
        // User A moves the node to { x: 400, y: 300 }
        writeNodePosition(docA, "shared-node", { x: 400, y: 300 });

        // User B edits the label to "Renamed by B"
        writeNodeData(docB, "shared-node", { label: "Renamed by B" });

        // Sync updates
        const updateFromA = Y.encodeStateAsUpdate(docA);
        const updateFromB = Y.encodeStateAsUpdate(docB);

        Y.applyUpdate(docB, updateFromA);
        Y.applyUpdate(docA, updateFromB);

        const finalA = toFlowGraph(docA);
        const finalB = toFlowGraph(docB);

        expect(finalA).toEqual(finalB);

        const node = finalA.nodes.find((n) => n.id === "shared-node")!;
        expect(node).toBeDefined();
        // BOTH changes survived!
        expect(node.position).toEqual({ x: 400, y: 300 });
        expect(node.data.label).toBe("Renamed by B");
    });

    it("allows AI MutableFlow edits and human edits to merge cleanly", () => {
        const doc = new Y.Doc();
        const flow = createMutableFlow(doc);

        flow.addNode({
            id: "ai-node-1",
            type: "canvasNode",
            position: { x: 10, y: 10 },
            data: { label: "AI Service", color: "", textColor: "", shape: "rectangle" },
        });

        // Simulate concurrent human edit directly on Y.Doc
        writeNode(getDocNodesMap(doc), {
            id: "human-node",
            type: "canvasNode",
            position: { x: 500, y: 500 },
            data: { label: "Human Node", color: "", textColor: "", shape: "diamond" },
        });

        const graph = flow.toJSON();
        expect(graph.nodes.map((n) => n.id).sort()).toEqual(["ai-node-1", "human-node"].sort());
    });
});
