/*
  Minimal, framework-free shapes of a diagram, used by the pure graph utilities (analysis, layout,
  export). React Flow's own node and edge types are structurally compatible with these, so callers
  map them with a one-liner and this package stays free of UI dependencies.
 */
export interface GraphNodeInput {
    id: string;
    label: string;
    shape?: string;
    /** Palette colours, used only by exporters. */
    color?: string;
    textColor?: string;
    width?: number;
    height?: number;
}

export interface GraphEdgeInput {
    id?: string;
    source: string;
    target: string;
    label?: string;
}

export interface GraphInput {
    nodes: readonly GraphNodeInput[];
    edges: readonly GraphEdgeInput[];
}

/** Edges whose endpoints both exist. Everything downstream assumes this. */
export const validEdges = (graph: GraphInput): GraphEdgeInput[] => {
    const ids = new Set(graph.nodes.map((node) => node.id));
    return graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target);
};

/** Undirected adjacency over the valid edges (parallel edges collapse). */
export const undirectedAdjacency = (graph: GraphInput): Map<string, Set<string>> => {
    const adjacency = new Map<string, Set<string>>(graph.nodes.map((node) => [node.id, new Set<string>()]));
    for (const edge of validEdges(graph)) {
        adjacency.get(edge.source)?.add(edge.target);
        adjacency.get(edge.target)?.add(edge.source);
    }
    return adjacency;
};
