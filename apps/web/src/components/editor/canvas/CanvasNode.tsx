"use client";

import { memo, useState, type KeyboardEvent } from "react";
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { DEFAULT_NODE_COLOR, isFreePoint, type ColorPair, type NodeShape } from "@repo/types";
import type { CanvasFlowNode } from "@/types";
import NodeColorToolbar from "./NodeColorToolbar";
import { cn } from "@/lib/utils";
import { ShapeBody } from "./shapes";
import { useTheme } from "@/lib/theme";
import { themedNodeColors } from "@/lib/nodeTheme";

const MIN_WIDTH = 80;
const MIN_HEIGHT = 40;

// Small brand-coloured dots, hidden until the node is hovered. All four are sources: with the canvas in
// loose connection mode that lets any handle connect to any other.
const HANDLE_CLASS =
  "!h-2.5 !w-2.5 !rounded-full !border-2 !border-base !bg-brand opacity-0 transition-opacity duration-150 group-hover:opacity-100";

const HANDLES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

/*
  One end of a free-standing line or arrow: a small dot to drag. The line attaches to a 1px handle at its
  centre, so it ends exactly on the dot. Faint until hovered or selected, so a diagram full of lines stays calm.
 */
const LinePoint = ({ selected }: { selected: boolean }) => (
  <div className="group relative flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing">
    <span
      data-export-hide=""
      className={cn(
        "h-2.5 w-2.5 rounded-full border-2 border-brand bg-elevated transition-opacity duration-150 group-hover:opacity-100",
        selected ? "opacity-100 shadow-[0_0_0_4px_var(--accent-primary-dim)]" : "opacity-40"
      )}
    />
    <Handle
      id="point"
      type="source"
      position={Position.Top}
      className="!left-1/2 !top-1/2 !h-px !w-px !min-h-0 !min-w-0 !border-0 !bg-transparent opacity-0"
    />
  </div>
);

/*
  Every edit goes through React Flow's own update helpers, which in this controlled canvas become
  change events for `useFlow` — so labels, colours and sizes sync to the whole room and
  land in this user's undo history like any other change.
 */
const CanvasNode = ({ id, data, selected }: NodeProps<CanvasFlowNode>) => {
  const { updateNodeData } = useReactFlow<CanvasFlowNode>();
  const [isEditing, setIsEditing] = useState(false);

  const savedShape = data.shape ?? "rectangle";
  const { resolved: theme } = useTheme();
  // `data` keeps the saved (dark-palette) pair; what is drawn depends on the theme.
  const savedFill = data.color || DEFAULT_NODE_COLOR.bg;
  const { bg: fill, text: textColor } = themedNodeColors(
    savedFill,
    data.textColor || DEFAULT_NODE_COLOR.text,
    theme,
  );
  const stroke = selected ? "var(--accent-primary)" : `${textColor}55`;

  if (isFreePoint(savedShape)) return <LinePoint selected={selected} />;
  const shape = savedShape as NodeShape;

  const handleColor = (pair: ColorPair) => updateNodeData(id, { color: pair.bg, textColor: pair.text });

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" || (event.key === "Enter" && !event.shiftKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  const label = isEditing ? (
    <textarea
      value={data.label}
      onChange={(event) => updateNodeData(id, { label: event.target.value })}
      onKeyDown={handleKeyDown}
      onBlur={() => setIsEditing(false)}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      rows={2}
      placeholder={shape}
      aria-label="Node label"
      className="nodrag nopan w-full resize-none bg-transparent text-center font-mono text-xs font-semibold leading-tight outline-none placeholder:opacity-50"
      style={{ color: textColor }}
    />
  ) : (
    <span
      className="line-clamp-3 w-full cursor-text select-none text-center text-xs font-semibold leading-tight tracking-wide"
      style={{ color: textColor }}
      onDoubleClick={() => setIsEditing(true)}
    >
      {data.label || (
        <span className="font-mono text-[10px] uppercase tracking-wider italic opacity-50">{shape}</span>
      )}
    </span>
  );

  return (
    <div className="group relative h-full w-full">
      <NodeColorToolbar visible={selected && !isEditing} activeColor={savedFill} onSelect={handleColor} />

      <NodeResizer
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        color="var(--accent-primary)"
        handleClassName="!h-2 !w-2 !rounded-full !border !border-base !bg-brand"
        lineClassName="!border-brand/60"
      />

      {HANDLES.map((handle) => (
        <Handle key={handle.id} id={handle.id} type="source" position={handle.position} className={HANDLE_CLASS} />
      ))}

      <ShapeBody shape={shape} fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.5} selected={selected}>
        {label}
      </ShapeBody>
    </div>
  );
};

export default memo(CanvasNode);
