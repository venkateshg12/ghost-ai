import { z } from "zod";

export const NODE_SHAPES = ["rectangle", "diamond", "circle", "pill", "cylinder", "hexagon"] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

export const CUSTOM_NODE_TYPE = "canvasNode";
export const CUSTOM_EDGE_TYPE = "canvasEdge";

export interface ColorPair {
    bg: string;
    text: string;
    label: string;
}

// Dark fill + vivid text pairs, tuned for the dark canvas (see context/ui-context.md).
export const NODE_COLORS: ColorPair[] = [
    { bg: "#1F1F1F", text: "#EDEDED", label: "Neutral" },
    { bg: "#10233D", text: "#52A8FF", label: "Blue" },
    { bg: "#2E1938", text: "#BF7AF0", label: "Purple" },
    { bg: "#331B00", text: "#FF990A", label: "Orange" },
    { bg: "#3C1618", text: "#FF6166", label: "Red" },
    { bg: "#3A1726", text: "#F75F8F", label: "Pink" },
    { bg: "#0F2E18", text: "#62C073", label: "Green" },
    { bg: "#062822", text: "#0AC7B4", label: "Teal" },
];

export const DEFAULT_NODE_COLOR = NODE_COLORS[0]!;
export const DEFAULT_EDGE_COLOR = "#f8fafc";

export interface CanvasNodeData {
    label: string;
    color: string;
    textColor: string;
    shape: NodeShape;
    [key: string]: unknown;
}

export interface CanvasEdgeData {
    label?: string;
    [key: string]: unknown;
}

/*
  The snapshot the editor autosaves. Nodes and edges are React Flow objects, so only the fields every
  one of them must have are checked; the rest passes through untouched. The caps keep one request from
  writing an unbounded blob.
 */
const canvasNodeSchema = z
    .object({
        id: z.string().min(1),
        position: z.object({ x: z.number(), y: z.number() }),
    })
    .passthrough();

const canvasEdgeSchema = z
    .object({
        id: z.string().min(1),
        source: z.string().min(1),
        target: z.string().min(1),
    })
    .passthrough();

export const canvasSnapshotSchema = z.object({
    nodes: z.array(canvasNodeSchema).max(2000).default([]),
    edges: z.array(canvasEdgeSchema).max(5000).default([]),
});
export type CanvasSnapshot = z.infer<typeof canvasSnapshotSchema>;
