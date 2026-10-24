import * as Y from "yjs";
import {
    getDocEdgesMap,
    getDocNodesMap,
    toFlowGraph,
    writeEdge,
    writeNode,
    type CanvasNodeData,
    type DocEdge,
    type DocNode,
} from "@repo/types";
import type { FlowEdge, FlowGraph, FlowNode } from "./graph";
import { internalFetch } from "../../realtime/internalClient";
import { getLocalRoom } from "../../realtime/local";

export interface MutableFlow<N = FlowNode, E = FlowEdge> {
    readonly nodes: readonly N[];
    readonly edges: readonly E[];
    getNode(id: string): N | undefined;
    getEdge(id: string): E | undefined;
    addNode(node: N): void;
    updateNode(id: string, patchOrUpdater: Partial<N> | ((node: N) => N)): void;
    updateNodeData(id: string, patchOrUpdater: Partial<CanvasNodeData> | ((data: CanvasNodeData) => CanvasNodeData)): void;
    removeNode(id: string): void;
    addEdge(edge: E): void;
    removeEdge(id: string): void;
    removeEdges(ids: readonly string[]): void;
    toJSON(): { nodes: readonly N[]; edges: readonly E[] };
}

export type Flow = MutableFlow<FlowNode, FlowEdge>;

export const createMutableFlow = (doc: Y.Doc): Flow => {
    const nodesMap = getDocNodesMap(doc);
    const edgesMap = getDocEdgesMap(doc);

    const getGraph = (): FlowGraph => {
        const g = toFlowGraph(doc);
        return {
            nodes: g.nodes as unknown as FlowNode[],
            edges: g.edges as unknown as FlowEdge[],
        };
    };

    return {
        get nodes() {
            return getGraph().nodes;
        },
        get edges() {
            return getGraph().edges;
        },
        getNode(id: string) {
            return getGraph().nodes.find((n) => n.id === id);
        },
        getEdge(id: string) {
            return getGraph().edges.find((e) => e.id === id);
        },
        addNode(node: FlowNode) {
            doc.transact(() => {
                writeNode(nodesMap, node as unknown as DocNode);
            }, "ai");
        },
        updateNode(id: string, patchOrUpdater: Partial<FlowNode> | ((node: FlowNode) => FlowNode)) {
            doc.transact(() => {
                const current = this.getNode(id);
                if (!current) return;
                const updated = typeof patchOrUpdater === "function" ? patchOrUpdater(current) : { ...current, ...patchOrUpdater };
                writeNode(nodesMap, updated as unknown as DocNode);
            }, "ai");
        },
        updateNodeData(id: string, patchOrUpdater: Partial<CanvasNodeData> | ((data: CanvasNodeData) => CanvasNodeData)) {
            doc.transact(() => {
                const current = this.getNode(id);
                if (!current) return;
                const updatedData =
                    typeof patchOrUpdater === "function"
                        ? patchOrUpdater(current.data)
                        : { ...current.data, ...patchOrUpdater };
                writeNode(nodesMap, { ...current, data: updatedData } as unknown as DocNode);
            }, "ai");
        },
        removeNode(id: string) {
            doc.transact(() => {
                nodesMap.delete(id);
                // Also remove attached edges
                const attached: string[] = [];
                edgesMap.forEach((e, edgeId) => {
                    const source = e.get("source");
                    const target = e.get("target");
                    if (source === id || target === id) attached.push(edgeId);
                });
                for (const edgeId of attached) {
                    edgesMap.delete(edgeId);
                }
            }, "ai");
        },
        addEdge(edge: FlowEdge) {
            doc.transact(() => {
                writeEdge(edgesMap, edge as unknown as DocEdge);
            }, "ai");
        },
        removeEdge(id: string) {
            doc.transact(() => {
                edgesMap.delete(id);
            }, "ai");
        },
        removeEdges(ids: readonly string[]) {
            doc.transact(() => {
                for (const id of ids) {
                    edgesMap.delete(id);
                }
            }, "ai");
        },
        toJSON() {
            return getGraph();
        },
    };
};

export const editFlow = async (
    roomId: string,
    callback: (flow: Flow) => void | Promise<void>
): Promise<void> => {
    // In the API process the room is edited directly; a Trigger.dev task has no local rooms and goes over HTTP.
    const localRoom = await getLocalRoom(roomId);
    if (localRoom) {
        const flow = createMutableFlow(localRoom.doc);
        await callback(flow);
        return;
    }

    // Otherwise, fetch state over internal API (e.g. from Trigger.dev task)
    const stateRes = await internalFetch(`/internal/rooms/${roomId}/state`);
    if (!stateRes.ok) {
        throw new Error(`Failed to fetch room state for ${roomId}: ${stateRes.status}`);
    }

    const arrayBuffer = await stateRes.arrayBuffer();
    const doc = new Y.Doc();
    if (arrayBuffer.byteLength > 0) {
        Y.applyUpdate(doc, new Uint8Array(arrayBuffer));
    }

    const before = Y.encodeStateVector(doc);
    const flow = createMutableFlow(doc);
    await callback(flow);

    const diff = Y.encodeStateAsUpdate(doc, before);
    if (diff.byteLength > 2) {
        const updateRes = await internalFetch(`/internal/rooms/${roomId}/update`, {
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream",
            },
            body: Buffer.from(diff),
        });

        if (!updateRes.ok) {
            throw new Error(`Failed to apply room update for ${roomId}: ${updateRes.status}`);
        }
    }
};

export const readFlow = async (roomId: string): Promise<FlowGraph> => {
    const localRoom = await getLocalRoom(roomId);
    if (localRoom) {
        return createMutableFlow(localRoom.doc).toJSON();
    }

    const stateRes = await internalFetch(`/internal/rooms/${roomId}/state`);
    if (!stateRes.ok) {
        return { nodes: [], edges: [] };
    }

    const arrayBuffer = await stateRes.arrayBuffer();
    const doc = new Y.Doc();
    if (arrayBuffer.byteLength > 0) {
        Y.applyUpdate(doc, new Uint8Array(arrayBuffer));
    }

    return createMutableFlow(doc).toJSON();
};
