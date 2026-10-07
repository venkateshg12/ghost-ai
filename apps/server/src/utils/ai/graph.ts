import {
    CUSTOM_EDGE_TYPE,
    CUSTOM_NODE_TYPE,
    DEFAULT_NODE_COLOR,
    NODE_COLORS,
    NODE_SHAPES,
    type CanvasEdgeData,
    type CanvasNodeData,
    type NodeShape,
} from "@repo/types";

import type { Edge, Node } from "@xyflow/react";

// The node and edge shapes written into the room. They must match what the editor creates itself
// (see apps/web canvas-flow drop handler) so AI-made and hand-made nodes behave the same. Type-only
// import: the server never loads React Flow at runtime.
export type FlowNode = Node<CanvasNodeData>;
export type FlowEdge = Edge<CanvasEdgeData>;

export interface FlowGraph {
    nodes: readonly FlowNode[];
    edges: readonly FlowEdge[];
}

export const DEFAULT_NODE_SIZE: Record<NodeShape, { width: number; height: number }> = {
    rectangle: { width: 160, height: 70 },
    diamond: { width: 130, height: 110 },
    circle: { width: 100, height: 100 },
    pill: { width: 160, height: 60 },
    cylinder: { width: 110, height: 120 },
    hexagon: { width: 150, height: 100 },
};

export const MIN_NODE_SIZE = { width: 80, height: 40 };
export const MAX_NODE_SIZE = { width: 480, height: 320 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const toShape = (value: string | undefined): NodeShape =>
    NODE_SHAPES.includes(value as NodeShape) ? (value as NodeShape) : "rectangle";

// Colours are named by palette label ("Blue"), so the model can never invent an off-palette hex.
export const toColorPair = (label: string | undefined) =>
    NODE_COLORS.find((pair) => pair.label.toLowerCase() === label?.toLowerCase()) ?? DEFAULT_NODE_COLOR;

export const buildNode = (input: {
    id: string;
    label: string;
    shape?: string;
    color?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
}): FlowNode => {
    const shape = toShape(input.shape);
    const colors = toColorPair(input.color);
    const size = DEFAULT_NODE_SIZE[shape];
    return {
        id: input.id,
        type: CUSTOM_NODE_TYPE,
        position: { x: Math.round(input.x), y: Math.round(input.y) },
        style: {
            width: clamp(input.width ?? size.width, MIN_NODE_SIZE.width, MAX_NODE_SIZE.width),
            height: clamp(input.height ?? size.height, MIN_NODE_SIZE.height, MAX_NODE_SIZE.height),
        },
        data: { label: input.label, shape, color: colors.bg, textColor: colors.text },
    };
};

export const buildEdge = (input: { id: string; source: string; target: string; label?: string }): FlowEdge => ({
    id: input.id,
    type: CUSTOM_EDGE_TYPE,
    source: input.source,
    target: input.target,
    // No markerEnd: the editor's edge renderer draws the arrowhead itself, for every edge.
    data: { label: input.label ?? "" },
});

export const sizeOf = (node: FlowNode) => ({
    width: Number(node.style?.width) || DEFAULT_NODE_SIZE.rectangle.width,
    height: Number(node.style?.height) || DEFAULT_NODE_SIZE.rectangle.height,
});

// A compact text form of the graph, for prompts: the model edits by id, so ids must be visible.
export const describeGraph = (graph: FlowGraph) => {
    if (graph.nodes.length === 0) return "The canvas is empty.";
    const labels = new Map(graph.nodes.map((node) => [node.id, node.data?.label || node.id]));
    const nodes = graph.nodes
        .map((node) => {
            const { width, height } = sizeOf(node);
            return `- id=${node.id} label="${node.data?.label ?? ""}" shape=${node.data?.shape ?? "rectangle"} x=${node.position.x} y=${node.position.y} w=${width} h=${height}`;
        })
        .join("\n");
    const edges = graph.edges
        .map((edge) => `- id=${edge.id} ${labels.get(edge.source) ?? edge.source} -> ${labels.get(edge.target) ?? edge.target}${edge.data?.label ? ` [${edge.data.label}]` : ""}`)
        .join("\n");
    return `Nodes:\n${nodes}\n\nEdges:\n${edges || "(none)"}`;
};
