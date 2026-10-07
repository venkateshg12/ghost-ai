"use client";

import type { DragEvent } from "react";
import type { DraggedShape } from "@/types";
import { SHAPE_PRESETS } from "./shapes";

export const SHAPE_DRAG_MIME = "application/ghost-shape";

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

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
      <div className="flex select-none items-center gap-1 rounded-full border border-surface-border-subtle bg-surface/85 px-3 py-2 shadow-2xl backdrop-blur-xl">
        {SHAPE_PRESETS.map((preset) => (
          <div
            key={preset.type}
            draggable
            role="button"
            tabIndex={-1}
            aria-label={`Drag to add ${preset.label}`}
            onDragStart={(event) => handleDragStart(event, { type: preset.type, width: preset.width, height: preset.height })}
            onDragEnd={onDragEnd}
            className="group relative flex h-10 w-10 cursor-grab items-center justify-center rounded-full text-copy-secondary transition-colors hover:bg-subtle hover:text-copy-primary active:cursor-grabbing"
          >
            {preset.icon}
            <div className="pointer-events-none absolute bottom-full mb-2.5 origin-bottom scale-0 whitespace-nowrap rounded-xl border border-surface-border bg-surface px-2.5 py-1.5 font-mono text-[10px] text-copy-primary shadow-xl transition-transform group-hover:scale-100">
              {preset.label}
              <span className="mt-0.5 block text-[8px] text-copy-muted">
                {preset.width} × {preset.height}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ShapePanel;
