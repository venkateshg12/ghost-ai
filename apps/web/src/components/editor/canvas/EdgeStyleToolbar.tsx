"use client";

import type { ReactNode } from "react";
import {
  EDGE_LINE_STYLES,
  EDGE_MARKERS,
  EDGE_PATH_TYPES,
  EDGE_WIDTHS,
  type CanvasEdgeStyle,
  type EdgeLineStyle,
  type EdgeMarker,
  type EdgePathType,
} from "@repo/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MarkerPreview } from "./edgeMarkers";
import { MARKER_LABELS, dashArrayOf } from "./edgeStyle";

interface EdgeStyleToolbarProps {
  style: CanvasEdgeStyle;
  onChange: (patch: Partial<CanvasEdgeStyle>) => void;
}

const Glyph = ({ children, width = 1.6, dash }: { children: ReactNode; width?: number; dash?: string }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} aria-hidden="true">
    {children}
  </svg>
);

const PATH_OPTIONS: Record<EdgePathType, { label: string; icon: ReactNode }> = {
  straight: { label: "Straight", icon: <Glyph><path d="M2.5 13 L13.5 3" /></Glyph> },
  curved: { label: "Curved", icon: <Glyph><path d="M2.5 12 C 2.5 3.5, 13.5 12.5, 13.5 4" /></Glyph> },
  elbow: { label: "Elbow", icon: <Glyph><path d="M2.5 12 H8 V4 H13.5" /></Glyph> },
};

const LINE_OPTIONS: Record<EdgeLineStyle, { label: string }> = {
  solid: { label: "Solid" },
  dashed: { label: "Dashed" },
  dotted: { label: "Dotted" },
};

const WIDTH_LABELS = ["Thin", "Bold", "Extra bold"];

const ToggleButton = ({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    onClick={onClick}
    className={cn(
      "flex h-7 w-7 items-center justify-center rounded-lg text-copy-secondary outline-none transition-colors hover:bg-subtle hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand",
      active && "bg-accent-dim text-brand hover:bg-accent-dim hover:text-brand"
    )}
  >
    {children}
  </button>
);

const Divider = () => <span className="mx-0.5 h-5 w-px bg-surface-border" aria-hidden="true" />;

const MarkerPicker = ({
  side,
  value,
  onChange,
}: {
  side: "start" | "end";
  value: EdgeMarker;
  onChange: (marker: EdgeMarker) => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      title={side === "start" ? "Start arrowhead" : "End arrowhead"}
      aria-label={side === "start" ? "Start arrowhead" : "End arrowhead"}
      className="flex h-7 items-center justify-center rounded-lg px-1.5 text-copy-secondary outline-none transition-colors hover:bg-subtle hover:text-copy-primary focus-visible:ring-2 focus-visible:ring-brand"
    >
      <MarkerPreview kind={value} side={side} />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="center" className="w-48 border-surface-border bg-elevated">
      {EDGE_MARKERS.map((marker) => (
        <DropdownMenuItem
          key={marker}
          onSelect={() => onChange(marker)}
          className={cn("gap-3 text-copy-secondary focus:text-copy-primary", marker === value && "text-brand")}
        >
          <MarkerPreview kind={marker} side={side} />
          <span className="text-xs">{MARKER_LABELS[marker]}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

/*
  Floats above a selected line or arrow, the way Excalidraw's properties panel does: how the line
  runs (straight, curved, elbow), how it is drawn (solid, dashed, dotted), how heavy it is, and what
  sits at each end. `nodrag nopan` keeps clicks here from moving the canvas.
 */
const EdgeStyleToolbar = ({ style, onChange }: EdgeStyleToolbarProps) => (
  <div
    className="nodrag nopan flex items-center gap-0.5 rounded-xl border border-surface-border bg-elevated/95 p-1 shadow-xl backdrop-blur-md"
    onPointerDown={(event) => event.stopPropagation()}
  >
    {EDGE_PATH_TYPES.map((pathType) => (
      <ToggleButton key={pathType} active={style.pathType === pathType} label={PATH_OPTIONS[pathType].label} onClick={() => onChange({ pathType })}>
        {PATH_OPTIONS[pathType].icon}
      </ToggleButton>
    ))}
    <Divider />
    {EDGE_LINE_STYLES.map((lineStyle) => (
      <ToggleButton key={lineStyle} active={style.lineStyle === lineStyle} label={LINE_OPTIONS[lineStyle].label} onClick={() => onChange({ lineStyle })}>
        <Glyph dash={dashArrayOf(lineStyle, 1.6)}>
          <path d="M2.5 8 H13.5" />
        </Glyph>
      </ToggleButton>
    ))}
    <Divider />
    {EDGE_WIDTHS.map((width, index) => (
      <ToggleButton key={width} active={style.strokeWidth === width} label={WIDTH_LABELS[index]!} onClick={() => onChange({ strokeWidth: width })}>
        <Glyph width={width}>
          <path d="M2.5 8 H13.5" />
        </Glyph>
      </ToggleButton>
    ))}
    <Divider />
    <MarkerPicker side="start" value={style.startMarker} onChange={(startMarker) => onChange({ startMarker })} />
    <MarkerPicker side="end" value={style.endMarker} onChange={(endMarker) => onChange({ endMarker })} />
  </div>
);

export default EdgeStyleToolbar;
