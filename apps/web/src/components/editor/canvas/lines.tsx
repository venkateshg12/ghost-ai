import type { ReactNode } from "react";
import type { CanvasEdgeStyle } from "@repo/types";

export interface LinePreset {
  id: string;
  label: string;
  /** How far the line runs when dropped, in canvas units: right by `width`, up by `height`. */
  width: number;
  height: number;
  style: Partial<CanvasEdgeStyle>;
  icon: ReactNode;
}

const Icon = ({ children, dash }: { children: ReactNode; dash?: string }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} aria-hidden="true">
    {children}
  </svg>
);

// Free-standing lines and arrows, like Excalidraw's line and arrow tools. Each is dropped as two draggable
// end points joined by an edge, and can be restyled afterwards from the toolbar over the selected line.
const NONE = { startMarker: "none", endMarker: "none" } as const;

export const LINE_PRESETS: LinePreset[] = [
  {
    id: "line",
    label: "Line",
    width: 160,
    height: 0,
    style: { pathType: "straight", ...NONE },
    icon: <Icon><path d="M4 16 L16 4" /></Icon>,
  },
  {
    id: "arrow",
    label: "Arrow",
    width: 160,
    height: 0,
    style: { pathType: "straight", endMarker: "arrow" },
    icon: <Icon><path d="M4 16 L16 4 M9 4 H16 V11" /></Icon>,
  },
  {
    id: "curved-arrow",
    label: "Curved arrow",
    width: 160,
    height: 70,
    style: { pathType: "curved", endMarker: "arrow" },
    icon: <Icon><path d="M4 16 C 4 6, 13 14, 16 5 M12 5.5 H16.5 V10" /></Icon>,
  },
  {
    id: "elbow-arrow",
    label: "Elbow arrow",
    width: 160,
    height: 70,
    style: { pathType: "elbow", endMarker: "arrow" },
    icon: <Icon><path d="M3 16 H10 V5 H17 M14 2.5 L17 5 L14 7.5" /></Icon>,
  },
  {
    id: "double-arrow",
    label: "Double arrow",
    width: 160,
    height: 0,
    style: { pathType: "straight", startMarker: "arrow", endMarker: "arrow" },
    icon: <Icon><path d="M4 16 L16 4 M9 4 H16 V11 M11 16 H4 V9" /></Icon>,
  },
  {
    id: "dashed-line",
    label: "Dashed line",
    width: 160,
    height: 0,
    style: { pathType: "straight", lineStyle: "dashed", ...NONE },
    icon: <Icon dash="2.5 3"><path d="M4 16 L16 4" /></Icon>,
  },
];
