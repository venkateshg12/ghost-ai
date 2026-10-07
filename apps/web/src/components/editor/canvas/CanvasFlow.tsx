"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
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
import { Cursors } from "@liveblocks/react-flow";
import { CUSTOM_EDGE_TYPE, CUSTOM_NODE_TYPE, DEFAULT_NODE_COLOR, type NodeShape } from "@repo/types";
import type { CanvasFlowEdge, CanvasFlowNode, DraggedShape } from "@/types";
import CanvasControlBar from "./CanvasControlBar";
import CanvasEdge from "./CanvasEdge";
import CanvasNode from "./CanvasNode";
import CollaboratorCursor from "./CollaboratorCursor";
import DragPreview from "./DragPreview";
import { SHAPE_DRAG_MIME } from "./ShapePanel";

import "@xyflow/react/dist/style.css";
import "@liveblocks/react-ui/styles.css";
import "@liveblocks/react-flow/styles.css";

const nodeTypes = { [CUSTOM_NODE_TYPE]: CanvasNode };
const edgeTypes = { [CUSTOM_EDGE_TYPE]: CanvasEdge };
const cursorComponents = { Cursor: CollaboratorCursor };

interface CanvasFlowProps {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  onNodesChange: OnNodesChange<CanvasFlowNode>;
  onEdgesChange: OnEdgesChange<CanvasFlowEdge>;
  onConnect: OnConnect;
  onDelete: OnDelete<CanvasFlowNode, CanvasFlowEdge>;
  draggedShape: DraggedShape | null;
  onDragFinished: () => void;
}

/*
  The collaborative canvas. Nodes and edges are controlled by `useLiveblocksFlow` in the parent, so
  every change — drag, connect, delete (Backspace/Delete), resize, label — goes through Liveblocks
  and reaches the whole room. The canvas fills its container edge to edge; panels float above it.
 */
const CanvasFlow = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDelete,
  draggedShape,
  onDragFinished,
}: CanvasFlowProps) => {
  const { screenToFlowPosition, addNodes } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const { zoom } = useViewport();
  const counter = useRef(0);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);

  const defaultEdgeOptions = useMemo(() => ({ type: CUSTOM_EDGE_TYPE }), []);

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

        addNodes({
          id: `${shape.type}-${Date.now()}-${counter.current}`,
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
    [screenToFlowPosition, addNodes, onDragFinished]
  );

  return (
    <div className="absolute inset-0 select-none bg-base" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <ReactFlow<CanvasFlowNode, CanvasFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        deleteKeyCode={["Backspace", "Delete"]}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        colorMode="dark"
        className="!bg-base text-copy-primary"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="var(--canvas-dot)" />
        <MiniMap pannable zoomable position="bottom-right" className="!bottom-14 !right-4" />
        <Cursors components={cursorComponents} />
        <CanvasControlBar />
      </ReactFlow>

      {draggedShape && dragPoint && <DragPreview shape={draggedShape} position={dragPoint} zoom={zoom} />}
    </div>
  );
};

export default CanvasFlow;
