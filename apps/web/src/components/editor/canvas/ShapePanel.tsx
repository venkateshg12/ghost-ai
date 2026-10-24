"use client";

import type { DragEvent } from "react";
import type { DraggedShape } from "@/types";
import { LINE_PRESETS } from "./lines";
import { SHAPE_PRESETS } from "./shapes";

export const SHAPE_DRAG_MIME = "application/plano-shape";

// A 1x1 transparent image, so the browser's own drag ghost doesn't sit next to ours.
let emptyDragImage: HTMLImageElement | null = null;
const getEmptyDragImage = () => {
  if (!emptyDragImage) {
    emptyDragImage = new Image();
    emptyDragImage.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  }
  return emptyDragImage;
};

interface ShapePanelProps {
  onDragStart: (shape: DraggedShape) => void;
  onDragEnd: () => void;
}

// Floating pill at the bottom-centre of the canvas. Drag a shape onto the canvas to add a node.
const ShapePanel = ({ onDragStart, onDragEnd }: ShapePanelProps) => {
  const handleDragStart = (event: DragEvent, shape: DraggedShape) => {
    event.dataTransfer.setData(SHAPE_DRAG_MIME, JSON.stringify(shape));
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setDragImage(getEmptyDragImage(), 0, 0);
    onDragStart(shape);
  };

  const items = [
    ...SHAPE_PRESETS.map((preset) => ({
      key: preset.type,
      label: preset.label,
      hint: `${preset.width} × ${preset.height}`,
      icon: preset.icon,
      payload: { type: preset.type, width: preset.width, height: preset.height } satisfies DraggedShape,
    })),
    ...LINE_PRESETS.map((preset) => ({
      key: preset.id,
      label: preset.label,
      hint: "Line",
      icon: preset.icon,
      payload: { type: "line", width: preset.width, height: preset.height, edge: preset.style } satisfies DraggedShape,
    })),
  ];

  const renderItem = (item: (typeof items)[number]) => (
    <div
      key={item.key}
      draggable
      role="button"
      tabIndex={-1}
      aria-label={`Drag to add ${item.label}`}
      onDragStart={(event) => handleDragStart(event, item.payload)}
      onDragEnd={onDragEnd}
      className="group relative flex h-9 w-9 cursor-grab items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary active:cursor-grabbing"
    >
      {item.icon}
      <div className="pointer-events-none absolute bottom-full mb-2.5 origin-bottom scale-0 whitespace-nowrap rounded-xl border border-surface-border bg-surface px-2.5 py-1.5 font-mono text-[10px] text-copy-primary shadow-xl transition-transform group-hover:scale-100">
        {item.label}
        <span className="mt-0.5 block text-[8px] text-copy-muted">{item.hint}</span>
      </div>
    </div>
  );

  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-30 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 xl:bottom-6">
      <div className="flex select-none flex-wrap items-center justify-center gap-0.5 rounded-3xl border border-surface-border-subtle bg-surface/85 px-3 py-2 shadow-2xl backdrop-blur-xl">
        {items.slice(0, SHAPE_PRESETS.length).map(renderItem)}
        <span className="mx-1 h-6 w-px bg-surface-border" aria-hidden="true" />
        {items.slice(SHAPE_PRESETS.length).map(renderItem)}
      </div>
    </div>
  );
};

export default ShapePanel;
