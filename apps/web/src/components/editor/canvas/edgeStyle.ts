import {
  DEFAULT_EDGE_STYLE,
  EDGE_LINE_STYLES,
  EDGE_MARKERS,
  EDGE_PATH_TYPES,
  type CanvasEdgeData,
  type CanvasEdgeStyle,
  type EdgeMarker,
} from "@repo/types";

/*
  Everything about how a line or arrow is drawn, shared by the edge renderer, its style toolbar and the
  panel's line presets. Styles live in the edge's `data`; anything missing or unrecognised falls back to
  DEFAULT_EDGE_STYLE, so edges made before styles existed (or by the AI) look exactly as they did.
 */
const pick = <T extends string>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export const resolveEdgeStyle = (data?: CanvasEdgeData): CanvasEdgeStyle => ({
  pathType: pick(EDGE_PATH_TYPES, data?.pathType, DEFAULT_EDGE_STYLE.pathType),
  lineStyle: pick(EDGE_LINE_STYLES, data?.lineStyle, DEFAULT_EDGE_STYLE.lineStyle),
  startMarker: pick(EDGE_MARKERS, data?.startMarker, DEFAULT_EDGE_STYLE.startMarker),
  endMarker: pick(EDGE_MARKERS, data?.endMarker, DEFAULT_EDGE_STYLE.endMarker),
  strokeWidth:
    typeof data?.strokeWidth === "number" && data.strokeWidth > 0 && data.strokeWidth <= 8
      ? data.strokeWidth
      : DEFAULT_EDGE_STYLE.strokeWidth,
});

// Dashes scale with the line so a bold dashed line doesn't turn into a row of dots.
export const dashArrayOf = (lineStyle: CanvasEdgeStyle["lineStyle"], width: number) => {
  if (lineStyle === "dashed") return `${Math.max(7, width * 4)} ${Math.max(5, width * 3)}`;
  // A near-zero dash with round caps is a dot.
  if (lineStyle === "dotted") return `0.1 ${width + 4}`;
  return undefined;
};

/* ---------- Arrowheads ---------- */

// Drawn in a 10x10 box pointing along +x. `refX` is where the line ends: the tip, or for the crow's foot
// the spread end that touches the shape.
type GlyphPaint = "filled" | "outline" | "open";
interface Glyph {
  path: string;
  refX: number;
  paint: GlyphPaint;
}

const CIRCLE = "M 1 5 A 4 4 0 1 0 9 5 A 4 4 0 1 0 1 5 z";
const DIAMOND = "M 0.5 5 L 5 1 L 9.5 5 L 5 9 z";

export const MARKER_GLYPHS: Record<Exclude<EdgeMarker, "none">, Glyph> = {
  arrow: { path: "M 1 1 L 9 5 L 1 9", refX: 9, paint: "open" },
  triangle: { path: "M 0 0 L 10 5 L 0 10 z", refX: 9, paint: "filled" },
  "triangle-outline": { path: "M 1 1 L 9.5 5 L 1 9 z", refX: 9.5, paint: "outline" },
  diamond: { path: DIAMOND, refX: 9.5, paint: "filled" },
  "diamond-outline": { path: DIAMOND, refX: 9.5, paint: "outline" },
  circle: { path: CIRCLE, refX: 9, paint: "filled" },
  "circle-outline": { path: CIRCLE, refX: 9, paint: "outline" },
  bar: { path: "M 6 0.5 L 6 9.5", refX: 6, paint: "open" },
  crowfoot: { path: "M 0 5 L 10 0.5 M 0 5 L 10 5 M 0 5 L 10 9.5", refX: 10, paint: "open" },
};

export const MARKER_LABELS: Record<EdgeMarker, string> = {
  none: "None",
  arrow: "Arrow",
  triangle: "Triangle",
  "triangle-outline": "Triangle outline",
  diamond: "Diamond",
  "diamond-outline": "Diamond outline",
  circle: "Dot",
  "circle-outline": "Circle",
  bar: "Bar",
  crowfoot: "Crow's foot",
};

export type { GlyphPaint };

// Hollow heads are filled with the canvas colour so the line doesn't show through them.
export const paintProps = (paint: GlyphPaint, color: string) => ({
  fill: paint === "filled" ? color : paint === "outline" ? "var(--bg-base)" : "none",
  stroke: paint === "filled" ? "none" : color,
});
