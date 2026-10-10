import dagre from "@dagrejs/dagre";
import type { GraphEdgeInput } from "./graph";

/*
  Layered left-to-right layout (dagre). Language models are poor at coordinates — they overlap nodes
  and ignore sizes — so the AI decides *what* is in the diagram and this decides *where* it goes. The
  same function runs on the server after an AI build and in the browser behind the "Tidy" button.
 */
export interface LayoutNode {
    id: string;
    width: number;
    height: number;
}

export interface LayoutOptions {
    direction?: "LR" | "TB";
    nodeSep?: number;
    rankSep?: number;
    /** Where the top-left of the laid-out graph lands. */
    originX?: number;
    originY?: number;
}

/** Top-left positions by node id (React Flow positions are top-left, dagre returns centres). */
export const layoutGraph = (
    nodes: readonly LayoutNode[],
    edges: readonly Pick<GraphEdgeInput, "source" | "target">[],
    { direction = "LR", nodeSep = 70, rankSep = 110, originX = 80, originY = 80 }: LayoutOptions = {}
): Map<string, { x: number; y: number }> => {
    const positions = new Map<string, { x: number; y: number }>();
    if (nodes.length === 0) return positions;

    const graph = new dagre.graphlib.Graph();
    graph.setGraph({ rankdir: direction, nodesep: nodeSep, ranksep: rankSep, marginx: 0, marginy: 0 });
    graph.setDefaultEdgeLabel(() => ({}));

    const known = new Set(nodes.map((node) => node.id));
    for (const node of nodes) graph.setNode(node.id, { width: node.width, height: node.height });
    for (const edge of edges) {
        if (known.has(edge.source) && known.has(edge.target) && edge.source !== edge.target) graph.setEdge(edge.source, edge.target);
    }

    dagre.layout(graph);

    for (const node of nodes) {
        const placed = graph.node(node.id);
        positions.set(node.id, {
            x: Math.round(placed.x - node.width / 2 + originX),
            y: Math.round(placed.y - node.height / 2 + originY),
        });
    }
    return positions;
};
