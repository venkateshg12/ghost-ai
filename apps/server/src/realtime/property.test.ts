import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
    getDocEdgesMap,
    getDocNodesMap,
    toFlowGraph,
    writeEdge,
    writeNode,
    writeNodePosition,
    type DocEdge,
    type DocNode,
} from "@repo/types";

describe("CRDT Convergence Property Test", () => {
    it("converges to identical flow graphs across 5 replicas under out-of-order and duplicate updates", () => {
        const REPLICA_COUNT = 5;
        const replicas = Array.from({ length: REPLICA_COUNT }, () => new Y.Doc());
        const updatesPool: Uint8Array[] = [];

        // Track updates generated on any replica
        for (let i = 0; i < REPLICA_COUNT; i++) {
            const doc = replicas[i]!;
            doc.on("update", (update: Uint8Array, origin: unknown) => {
                if (origin === "local") {
                    updatesPool.push(update);
                }
            });
        }

        // Generate concurrent random operations across different replicas
        // Replica 0: Adds initial nodes
        replicas[0]!.transact(() => {
            const nodes = getDocNodesMap(replicas[0]!);
            writeNode(nodes, {
                id: "node-1",
                type: "custom",
                position: { x: 100, y: 100 },
                data: { label: "Client Service", color: "#3b82f6", textColor: "#ffffff", shape: "rectangle" },
            } as DocNode);
            writeNode(nodes, {
                id: "node-2",
                type: "custom",
                position: { x: 400, y: 100 },
                data: { label: "Database", color: "#10b981", textColor: "#ffffff", shape: "cylinder" },
            } as DocNode);
        }, "local");

        // Replica 1: Adds an edge, moves node-1, and later removes edge-1-2
        replicas[1]!.transact(() => {
            const edges = getDocEdgesMap(replicas[1]!);
            writeEdge(edges, {
                id: "edge-1-2",
                source: "node-1",
                target: "node-2",
                type: "custom",
                data: { label: "queries" },
            } as DocEdge);
            writeNodePosition(replicas[1]!, "node-1", { x: 150, y: 120 });
        }, "local");

        replicas[1]!.transact(() => {
            const edges = getDocEdgesMap(replicas[1]!);
            edges.delete("edge-1-2");
        }, "local");

        // Replica 2: Concurrently moves node-1 to a different spot and edits label
        replicas[2]!.transact(() => {
            writeNodePosition(replicas[2]!, "node-1", { x: 200, y: 180 });
            const nodes = getDocNodesMap(replicas[2]!);
            const node1 = nodes.get("node-1");
            if (node1) {
                const data = (node1.get("data") as Record<string, unknown>) || {};
                node1.set("data", { ...data, label: "Updated Service API" });
            }
        }, "local");

        // Replica 3: Adds node-3 and connects it
        replicas[3]!.transact(() => {
            const nodes = getDocNodesMap(replicas[3]!);
            const edges = getDocEdgesMap(replicas[3]!);
            writeNode(nodes, {
                id: "node-3",
                type: "custom",
                position: { x: 250, y: 300 },
                data: { label: "Cache Redis", color: "#ef4444", textColor: "#ffffff", shape: "rectangle" },
            } as DocNode);
            writeEdge(edges, {
                id: "edge-1-3",
                source: "node-1",
                target: "node-3",
                type: "custom",
                data: { label: "caches" },
            } as DocEdge);
        }, "local");

        // Replica 4: Creates another node concurrently
        replicas[4]!.transact(() => {
            const nodes = getDocNodesMap(replicas[4]!);
            writeNode(nodes, {
                id: "node-4",
                type: "custom",
                position: { x: 50, y: 50 },
                data: { label: "Auth Proxy", color: "#8b5cf6", textColor: "#ffffff", shape: "rectangle" },
            } as DocNode);
        }, "local");

        // Shuffle updates and inject duplicates to simulate chaotic network arrival
        const shuffledWithDuplicates = [...updatesPool, ...updatesPool].sort(() => Math.random() - 0.5);

        // Apply all updates to every replica in shuffled order
        for (const replica of replicas) {
            for (const update of shuffledWithDuplicates) {
                Y.applyUpdate(replica, update, "network");
            }
        }

        // Extract flow graphs from each replica
        const graphSnapshots = replicas.map((doc) => toFlowGraph(doc));
        const baseline = JSON.stringify(graphSnapshots[0]);

        // Assert all 5 replicas reached identical convergent states
        for (let i = 1; i < REPLICA_COUNT; i++) {
            expect(JSON.stringify(graphSnapshots[i])).toEqual(baseline);
        }

        // Verify graph contains expected elements
        const finalGraph = graphSnapshots[0]!;
        const nodeIds = finalGraph.nodes.map((n) => n.id).sort();
        expect(nodeIds).toEqual(["node-1", "node-2", "node-3", "node-4"]);

        // edge-1-2 was deleted by replica 4, edge-1-3 survives
        const edgeIds = finalGraph.edges.map((e) => e.id);
        expect(edgeIds).toContain("edge-1-3");
        expect(edgeIds).not.toContain("edge-1-2");
    });
});
