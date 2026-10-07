"use client";

import { memo, useState, type KeyboardEvent } from "react";
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { DEFAULT_NODE_COLOR, type ColorPair } from "@repo/types";
import type { CanvasFlowNode } from "@/types";
import NodeColorToolbar from "./NodeColorToolbar";
import { ShapeBody } from "./shapes";

const MIN_WIDTH = 80;
const MIN_HEIGHT = 40;

// Small white dots, hidden until the node is hovered. All four are sources: with the canvas in
// loose connection mode that lets any handle connect to any other.
const HANDLE_CLASS =
  "!h-2.5 !w-2.5 !rounded-full !border-2 !border-base !bg-white opacity-0 transition-opacity duration-150 group-hover:opacity-100";

const HANDLES = [
  { id: "top", position: Position.Top },
  { id: "right", position: Position.Right },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
];

/*
  Every edit goes through React Flow's own update helpers, which in this controlled canvas become
  change events for `useLiveblocksFlow` — so labels, colours and sizes sync to the whole room and
  land in Liveblocks undo history like any other change.
 */
const CanvasNode = ({ id, data, selected }: NodeProps<CanvasFlowNode>) => {
  const { updateNodeData } = useReactFlow<CanvasFlowNode>();
  const [isEditing, setIsEditing] = useState(false);

  const shape = data.shape ?? "rectangle";
  const fill = data.color || DEFAULT_NODE_COLOR.bg;
  const textColor = data.textColor || DEFAULT_NODE_COLOR.text;
  const stroke = selected ? "var(--accent-primary)" : `${textColor}55`;

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
      <NodeColorToolbar visible={selected && !isEditing} activeColor={fill} onSelect={handleColor} />

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
