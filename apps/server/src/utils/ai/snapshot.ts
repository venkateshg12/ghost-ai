import type { Edge, Node } from "@xyflow/react";
import { putText, readText, removeObject, storagePaths } from "../storage";
import { editFlow } from "./flow";
import type { FlowEdge, FlowGraph, FlowNode } from "./graph";

/*
  Undo for AI edits. Before a run changes the canvas, the graph it saw is written to private blob
  storage (Postgres keeps only the reference, on the TaskRun row). Reverting puts exactly that graph
  back — the state before the run, so edits made by others since are replaced too.
 */
export const saveSnapshot = async (projectId: string, runId: string, graph: FlowGraph): Promise<string> =>
    putText(storagePaths.canvasHistory(projectId, runId), JSON.stringify({ nodes: graph.nodes, edges: graph.edges }), "application/json");

export const loadSnapshot = async (reference: string): Promise<FlowGraph | null> => {
    const content = await readText(reference);
    if (!content) return null;
    try {
        const parsed = JSON.parse(content) as { nodes?: Node[]; edges?: Edge[] };
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;
        return { nodes: parsed.nodes as FlowNode[], edges: parsed.edges as FlowEdge[] };
    } catch {
        return null;
    }
};

export const restoreGraph = (roomId: string, graph: FlowGraph) =>
    editFlow(roomId, (flow) => {
        flow.removeEdges(flow.edges.map((edge) => edge.id));
        for (const node of [...flow.nodes]) flow.removeNode(node.id);
        for (const node of graph.nodes) flow.addNode(node);
        for (const edge of graph.edges) flow.addEdge(edge);
    });

export const deleteSnapshot = (reference: string) => removeObject(reference);
