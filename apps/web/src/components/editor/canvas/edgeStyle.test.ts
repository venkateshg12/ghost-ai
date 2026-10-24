import { describe, expect, it } from "vitest";
import { DEFAULT_EDGE_STYLE, EDGE_MARKERS } from "@repo/types";
import { MARKER_GLYPHS, MARKER_LABELS, dashArrayOf, resolveEdgeStyle } from "./edgeStyle";

describe("resolveEdgeStyle", () => {
  it("gives an unstyled edge the original look: elbow, solid, filled arrowhead at the end", () => {
    expect(resolveEdgeStyle(undefined)).toEqual(DEFAULT_EDGE_STYLE);
    expect(resolveEdgeStyle({ label: "HTTPS" })).toEqual(DEFAULT_EDGE_STYLE);
    expect(DEFAULT_EDGE_STYLE).toMatchObject({ pathType: "elbow", startMarker: "none", endMarker: "triangle" });
  });

  it("keeps valid styles and falls back per field on bad data", () => {
    const style = resolveEdgeStyle({
      pathType: "curved",
      lineStyle: "wavy" as never,
      startMarker: "bar",
      endMarker: "nope" as never,
      strokeWidth: 99,
    });
    expect(style).toEqual({ ...DEFAULT_EDGE_STYLE, pathType: "curved", startMarker: "bar" });
  });
});

describe("dashArrayOf", () => {
  it("is solid, dashed or dotted, scaling with the width", () => {
    expect(dashArrayOf("solid", 2)).toBeUndefined();
    expect(dashArrayOf("dashed", 1.5)).toBe("7 5");
    expect(dashArrayOf("dashed", 4)).toBe("16 12");
    expect(dashArrayOf("dotted", 2)).toBe("0.1 6");
  });
});

describe("arrowheads", () => {
  it("has a drawing and a label for every marker except none", () => {
    for (const marker of EDGE_MARKERS) {
      expect(MARKER_LABELS[marker]).toBeTruthy();
      if (marker !== "none") expect(MARKER_GLYPHS[marker].path).toMatch(/^M /);
    }
  });
});
