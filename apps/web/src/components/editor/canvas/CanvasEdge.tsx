"use client";

import { memo, useState, type KeyboardEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import type { CanvasEdgeStyle } from "@repo/types";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";
import EdgeStyleToolbar from "./EdgeStyleToolbar";
import { EdgeMarkerDef } from "./edgeMarkers";
import { dashArrayOf, resolveEdgeStyle } from "./edgeStyle";

type PathParams = Parameters<typeof getSmoothStepPath>[0];

const pathFor = (pathType: CanvasEdgeStyle["pathType"], params: PathParams) => {
  if (pathType === "straight") return getStraightPath(params);
  if (pathType === "curved") return getBezierPath(params);
  return getSmoothStepPath({ ...params, borderRadius: 8 });
};

/*
  A line or arrow with its own arrowheads, so edges look the same whether a person drew them, a template
  brought them, or the AI wrote them server-side. How it runs, how it is drawn and what sits at each end
  come from the edge's data (see edgeStyle.tsx); an edge with no style is the original right-angle arrow.
  Dim at rest, bright on hover/selection, and easy to hit thanks to BaseEdge's wide invisible interaction path.
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

  const style = resolveEdgeStyle(data);

  // A free-standing line has no handle sides to leave from, so elbows and curves leave along its main direction.
  let fromSide = sourcePosition;
  let toSide = targetPosition;
  if (data?.free) {
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    if (Math.abs(dx) >= Math.abs(dy)) {
      fromSide = dx >= 0 ? Position.Right : Position.Left;
      toSide = dx >= 0 ? Position.Left : Position.Right;
    } else {
      fromSide = dy >= 0 ? Position.Bottom : Position.Top;
      toSide = dy >= 0 ? Position.Top : Position.Bottom;
    }
  }

  const [edgePath, labelX, labelY] = pathFor(style.pathType, {
    sourceX,
    sourceY,
    sourcePosition: fromSide,
    targetX,
    targetY,
    targetPosition: toSide,
  });

  const changeStyle = (patch: Partial<CanvasEdgeStyle>) => updateEdgeData(id, patch);

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
  const startId = `plano-start-${id}`;
  const endId = `plano-end-${id}`;
  const width = style.strokeWidth + (selected ? 0.5 : 0);

  return (
    <>
      <defs>
        <EdgeMarkerDef id={startId} kind={style.startMarker} color={stroke} />
        <EdgeMarkerDef id={endId} kind={style.endMarker} color={stroke} />
      </defs>
      <g onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onDoubleClick={startEditing}>
        <BaseEdge
          id={id}
          path={edgePath}
          markerStart={style.startMarker === "none" ? undefined : `url(#${startId})`}
          markerEnd={style.endMarker === "none" ? undefined : `url(#${endId})`}
          interactionWidth={20}
          style={{
            stroke,
            strokeWidth: width,
            strokeDasharray: dashArrayOf(style.lineStyle, width),
            strokeLinecap: "round",
            strokeLinejoin: "round",
            opacity: active ? 1 : 0.7,
            filter: active ? "drop-shadow(0 0 4px color-mix(in srgb, var(--accent-primary) 35%, transparent))" : undefined,
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
        {selected && !isEditing && (
          <div
            className="absolute"
            // Above the nodes layer, or a free line's end dots would sit on top of the toolbar and swallow its clicks.
            style={{ transform: `translate(-50%, -100%) translate(${labelX}px, ${Math.min(sourceY, targetY, labelY) - 20}px)`, pointerEvents: "all", zIndex: 2000 }}
          >
            <EdgeStyleToolbar style={style} onChange={changeStyle} />
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
};

export default memo(CanvasEdge);
