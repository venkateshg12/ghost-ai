"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MiniMap,
  ReactFlow,
  useReactFlow,
  useViewport,
  type OnConnect,
  type OnDelete,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import {
  CUSTOM_EDGE_TYPE,
  CUSTOM_NODE_TYPE,
  DEFAULT_NODE_COLOR,
  FREE_POINT_SHAPE,
  isFreePoint,
  type NodeShape,
} from "@repo/types";
import type { CanvasFlowEdge, CanvasFlowNode, DraggedShape } from "@/types";
import { useTheme } from "@/lib/theme";
import CanvasControlBar, { type CanvasHistory } from "./CanvasControlBar";
import CanvasEdge from "./CanvasEdge";
import CanvasNode from "./CanvasNode";
import DragPreview from "./DragPreview";
import { SHAPE_DRAG_MIME } from "./ShapePanel";

import "@xyflow/react/dist/style.css";

const nodeTypes = { [CUSTOM_NODE_TYPE]: CanvasNode };
const edgeTypes = { [CUSTOM_EDGE_TYPE]: CanvasEdge };

interface CanvasFlowProps {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  onNodesChange: OnNodesChange<CanvasFlowNode>;
  onEdgesChange: OnEdgesChange<CanvasFlowEdge>;
  onConnect: OnConnect;
  onDelete: OnDelete<CanvasFlowNode, CanvasFlowEdge>;
  draggedShape: DraggedShape | null;
  onDragFinished: () => void;
  /** Undo/redo for the control bar — the room's history, or the local draft's. */
  history: CanvasHistory;
  /** Pointer position in flow space, or null when it leaves. Only collaborative canvases pass these. */
  onCursorMove?: (cursor: { x: number; y: number } | null) => void;
  /** Layers drawn inside the flow (e.g. other people's cursors). */
  children?: ReactNode;
}

/*
  The canvas. Nodes and edges are controlled by the parent — `useFlow` (realtime room) for a saved
  project, `useLocalFlow` (this browser only) for the signed-out draft — so this component knows nothing
  about where they live. The canvas fills its container edge to edge; panels float above it.
 */
// The end points of a free line are small enough to never be mistaken for a shape, big enough to grab.
const POINT_SIZE = 16;

const CanvasFlow = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDelete,
  draggedShape,
  onDragFinished,
  history,
  onCursorMove,
  children,
}: CanvasFlowProps) => {
  const { screenToFlowPosition, addNodes, addEdges, deleteElements } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const { zoom } = useViewport();
  const { resolved: theme } = useTheme();
  const counter = useRef(0);
  const lastPointerMove = useRef(0);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);

  // Deleting a free line (or one end of it) must not leave its other end behind as a stray dot.
  const handleDelete = useCallback(
    (deleted: { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] }) => {
      onDelete(deleted);
      const gone = new Set(deleted.nodes.map((node) => node.id));
      const goneEdges = new Set(deleted.edges.map((edge) => edge.id));
      const kept = edges.filter((edge) => !goneEdges.has(edge.id) && !gone.has(edge.source) && !gone.has(edge.target));
      const stillUsed = new Set(kept.flatMap((edge) => [edge.source, edge.target]));
      const stray = nodes.filter((node) => isFreePoint(node.data?.shape) && !gone.has(node.id) && !stillUsed.has(node.id));
      if (stray.length > 0) void deleteElements({ nodes: stray.map((node) => ({ id: node.id })) });
    },
    [onDelete, nodes, edges, deleteElements]
  );

  const defaultEdgeOptions = useMemo(() => ({ type: CUSTOM_EDGE_TYPE }), []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!onCursorMove) return;
      const now = Date.now();
      if (now - lastPointerMove.current < 40) return;
      lastPointerMove.current = now;
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      onCursorMove({ x: Math.round(flowPos.x), y: Math.round(flowPos.y) });
    },
    [screenToFlowPosition, onCursorMove]
  );

  const handlePointerLeave = useCallback(() => {
    onCursorMove?.(null);
  }, [onCursorMove]);

  const handleDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(SHAPE_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragPoint({ x: event.clientX, y: event.clientY });
  }, []);

  const handleDragLeave = useCallback(() => setDragPoint(null), []);

  // The node's centre lands exactly under the cursor: the drop point is converted into flow space
  // (accounting for pan and zoom) and the node is offset by half its size. The viewport is never
  // touched, so dropping the first node doesn't zoom.
  const handleDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDragPoint(null);
      onDragFinished();

      const raw = event.dataTransfer.getData(SHAPE_DRAG_MIME);
      if (!raw) return;

      try {
        const shape = JSON.parse(raw) as DraggedShape;
        const center = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        counter.current += 1;
        const stamp = `${Date.now()}-${counter.current}`;

        if (shape.edge) {
          // A free line is two small end points joined by an edge; dragging either end reshapes it.
          const makePoint = (suffix: string, x: number, y: number): CanvasFlowNode => ({
            id: `point-${stamp}-${suffix}`,
            type: CUSTOM_NODE_TYPE,
            position: { x: x - POINT_SIZE / 2, y: y - POINT_SIZE / 2 },
            style: { width: POINT_SIZE, height: POINT_SIZE },
            data: {
              label: "",
              color: DEFAULT_NODE_COLOR.bg,
              textColor: DEFAULT_NODE_COLOR.text,
              shape: FREE_POINT_SHAPE,
            },
          });
          const start = makePoint("a", center.x - shape.width / 2, center.y + shape.height / 2);
          const end = makePoint("b", center.x + shape.width / 2, center.y - shape.height / 2);
          addNodes([start, end]);
          addEdges({
            id: `line-${stamp}`,
            type: CUSTOM_EDGE_TYPE,
            source: start.id,
            target: end.id,
            data: { label: "", free: true, ...shape.edge },
          });
          return;
        }

        addNodes({
          id: `${shape.type}-${stamp}`,
          type: CUSTOM_NODE_TYPE,
          position: { x: center.x - shape.width / 2, y: center.y - shape.height / 2 },
          style: { width: shape.width, height: shape.height },
          data: {
            label: "",
            color: DEFAULT_NODE_COLOR.bg,
            textColor: DEFAULT_NODE_COLOR.text,
            shape: shape.type as NodeShape,
          },
        });
      } catch (error) {
        console.error("Dropped shape payload could not be read:", error);
      }
    },
    [screenToFlowPosition, addNodes, addEdges, onDragFinished]
  );

  return (
    <div
      className="absolute inset-0 select-none bg-base"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={handleDelete}
        deleteKeyCode={["Backspace", "Delete"]}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        colorMode={theme}
        className="!bg-base text-copy-primary"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--canvas-dot)" />
        <MiniMap pannable zoomable position="bottom-right" className="!bottom-14 !right-4" />
        {children}
        <CanvasControlBar history={history} />
      </ReactFlow>

      {draggedShape && dragPoint && <DragPreview shape={draggedShape} position={dragPoint} zoom={zoom} />}
    </div>
  );
};

export default CanvasFlow;
