import type { NodeShape } from "@repo/types";
import type { DraggedShape } from "@/types";
import { ShapeBody } from "./shapes";

interface DragPreviewProps {
  shape: DraggedShape;
  position: { x: number; y: number };
  zoom: number;
}

// Translucent ghost of the shape being dragged, centred on the cursor at the canvas' current zoom —
// exactly where and how big the node will be when dropped.
const DragPreview = ({ shape, position, zoom }: DragPreviewProps) => {
  const width = shape.width * zoom;
  // A line is dropped as a run from its start to its end, so a flat one still needs room to show.
  const height = (shape.edge ? Math.max(shape.height, 12) : shape.height) * zoom;

  return (
    <div
      className="pointer-events-none fixed z-50 opacity-50"
      style={{ left: position.x - width / 2, top: position.y - height / 2, width, height }}
      aria-hidden="true"
    >
      {shape.edge ? (
        <svg width={width} height={height} className="overflow-visible">
          <line
            x1={0}
            y1={shape.height === 0 ? height / 2 : height}
            x2={width}
            y2={shape.height === 0 ? height / 2 : 0}
            stroke="var(--accent-primary)"
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <ShapeBody shape={shape.type as NodeShape} fill="var(--bg-surface)" stroke="var(--accent-primary)" strokeWidth={2} dashed />
      )}
    </div>
  );
};

export default DragPreview;
