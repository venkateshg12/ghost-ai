"use client";

import { memo, useState, type KeyboardEvent } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";

/*
  Right-angle edge with its own arrowhead, so edges look the same whether a person drew them, a
  template brought them, or the AI wrote them server-side. Dim at rest, bright on hover/selection,
  and easy to hit thanks to BaseEdge's wide invisible interaction path.
 */
const CanvasEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps<CanvasFlowEdge>) => {
  const { updateEdgeData } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const label = data?.label ?? "";
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(label);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const startEditing = () => {
    setDraft(label);
    setIsEditing(true);
  };

  const save = () => {
    setIsEditing(false);
    if (draft !== label) updateEdgeData(id, { label: draft.trim() });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Escape") {
      event.preventDefault();
      save();
    }
  };

  const active = selected || isHovered;
  const stroke = selected ? "var(--accent-primary)" : isHovered ? "var(--canvas-edge-hover)" : "var(--canvas-edge)";
  const markerId = `ghost-arrow-${id}`;

  return (
    <>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
      <g onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onDoubleClick={startEditing}>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={`url(#${markerId})`}
          interactionWidth={20}
          style={{
            stroke,
            strokeWidth: selected ? 2 : 1.5,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            opacity: active ? 1 : 0.7,
            filter: active ? "drop-shadow(0 0 4px rgba(0, 200, 212, 0.35))" : undefined,
            transition: "stroke 150ms, opacity 150ms",
          }}
        />
      </g>

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isEditing ? (
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={save}
              autoFocus
              placeholder="Edge label..."
              aria-label="Edge label"
              size={Math.max(draft.length, 10)}
              className="rounded-xl border border-brand bg-elevated/95 px-2 py-0.5 text-center font-mono text-xs text-copy-primary shadow-xl outline-none"
            />
          ) : label ? (
            <button
              type="button"
              onDoubleClick={startEditing}
              className="rounded-full border border-surface-border-subtle bg-elevated/90 px-2.5 py-0.5 font-mono text-xs text-copy-secondary shadow-md backdrop-blur-md transition-colors hover:text-copy-primary"
            >
              {label}
            </button>
          ) : selected ? (
            <button
              type="button"
              onDoubleClick={startEditing}
              className="rounded-xl border border-dashed border-surface-border-subtle bg-elevated/60 px-2 py-0.5 font-mono text-[11px] text-copy-faint hover:text-copy-secondary"
            >
              Double-click to label
            </button>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default memo(CanvasEdge);
