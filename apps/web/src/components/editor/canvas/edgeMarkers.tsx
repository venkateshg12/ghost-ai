import type { EdgeMarker } from "@repo/types";
import { MARKER_GLYPHS, paintProps } from "./edgeStyle";

/** One <marker> for an SVG <defs>; the edge line references it by id (start and end each get their own). */
export const EdgeMarkerDef = ({ id, kind, color }: { id: string; kind: EdgeMarker; color: string }) => {
  if (kind === "none") return null;
  const glyph = MARKER_GLYPHS[kind];
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={glyph.refX}
      refY={5}
      markerWidth={7}
      markerHeight={7}
      orient="auto-start-reverse"
      overflow="visible"
    >
      <path d={glyph.path} {...paintProps(glyph.paint, color)} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
    </marker>
  );
};

/** A small picture of a line ending in this head, for menus. `side` says which end of the line it sits on. */
export const MarkerPreview = ({ kind, side }: { kind: EdgeMarker; side: "start" | "end" }) => {
  const glyph = kind === "none" ? null : MARKER_GLYPHS[kind];
  const lineFrom = side === "end" ? 2 : 6;
  const lineTo = side === "end" ? 22 : 26;
  // The end head sits at x=22 pointing right; the start head at x=6 is the same drawing mirrored.
  const transform = glyph
    ? side === "end"
      ? `translate(${22 - glyph.refX}, 1)`
      : `translate(${6 + glyph.refX}, 1) scale(-1, 1)`
    : undefined;

  return (
    <svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true" className="shrink-0">
      <path d={`M ${lineFrom} 6 H ${lineTo}`} stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" fill="none" />
      {glyph && (
        <path
          d={glyph.path}
          transform={transform}
          {...paintProps(glyph.paint, "currentColor")}
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};
