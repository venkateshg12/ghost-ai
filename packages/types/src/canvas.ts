import { z } from "zod";

export const NODE_SHAPES = [
    "rectangle",
    "diamond",
    "circle",
    "pill",
    "cylinder",
    "hexagon",
    "triangle",
    "parallelogram",
    "cloud",
    "document",
    "star",
    "text",
] as const;
export type NodeShape = (typeof NODE_SHAPES)[number];

/*
  The end of a free-standing line or arrow: a tiny draggable node the line is attached to. It is not in
  NODE_SHAPES because nobody (the AI included) adds one as a diagram element, and exports, analysis and
  layout skip it.
 */
export const FREE_POINT_SHAPE = "point";
export type CanvasShape = NodeShape | typeof FREE_POINT_SHAPE;
export const isFreePoint = (shape: string | undefined): boolean => shape === FREE_POINT_SHAPE;

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

/* ---------- Edge style (lines and arrows) ---------- */

// elbow = right-angle with rounded corners, straight = one sharp segment, curved = smooth bezier.
export const EDGE_PATH_TYPES = ["elbow", "straight", "curved"] as const;
export type EdgePathType = (typeof EDGE_PATH_TYPES)[number];

export const EDGE_LINE_STYLES = ["solid", "dashed", "dotted"] as const;
export type EdgeLineStyle = (typeof EDGE_LINE_STYLES)[number];

// What is drawn at an end of the line. "arrow" is the open "V"; "triangle" the filled head.
export const EDGE_MARKERS = [
    "none",
    "arrow",
    "triangle",
    "triangle-outline",
    "diamond",
    "diamond-outline",
    "circle",
    "circle-outline",
    "bar",
    "crowfoot",
] as const;
export type EdgeMarker = (typeof EDGE_MARKERS)[number];

// Thin, bold, extra bold.
export const EDGE_WIDTHS = [1.5, 2.5, 4] as const;

export interface CanvasEdgeStyle {
    pathType: EdgePathType;
    lineStyle: EdgeLineStyle;
    startMarker: EdgeMarker;
    endMarker: EdgeMarker;
    strokeWidth: number;
}

// What an edge looks like when its data says nothing: how every edge looked before styles existed.
export const DEFAULT_EDGE_STYLE: CanvasEdgeStyle = {
    pathType: "elbow",
    lineStyle: "solid",
    startMarker: "none",
    endMarker: "triangle",
    strokeWidth: EDGE_WIDTHS[0],
};

export interface CanvasNodeData {
    label: string;
    color: string;
    textColor: string;
    shape: CanvasShape;
    [key: string]: unknown;
}

export interface CanvasEdgeData extends Partial<CanvasEdgeStyle> {
    label?: string;
    /** A free-standing line or arrow (both ends are free points), not a connection between two shapes. */
    free?: boolean;
    [key: string]: unknown;
}

/*
  The persisted canvas snapshot (the room's JSON copy, and the signed-out draft in the browser). Nodes and edges are React Flow objects, so only the fields every
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
