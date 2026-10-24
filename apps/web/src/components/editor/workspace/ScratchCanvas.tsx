"use client";

import { useCallback, useState } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { useLocalFlow } from "@/hooks/canvas/useLocalFlow";
import { useEditorStore } from "@/store/editor.store";
import type { CanvasFlowEdge, CanvasFlowNode, DraggedShape } from "@/types";
import CanvasFlow from "../canvas/CanvasFlow";
import ShapePanel from "../canvas/ShapePanel";
import StarterTemplatesModal from "../canvas/StarterTemplatesModal";
import type { CanvasTemplate } from "../canvas/starter-templates";

const FIT_VIEW_OPTIONS = { duration: 400, padding: 0.2, maxZoom: 1 };

const Scratch = () => {
  const { nodes, edges, hydrated, onNodesChange, onEdgesChange, onConnect, onDelete, replaceGraph, history } =
    useLocalFlow();
  const { fitView } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const dialog = useEditorStore((state) => state.dialog);
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const [draggedShape, setDraggedShape] = useState<DraggedShape | null>(null);

  const handleImportTemplate = useCallback(
    (template: CanvasTemplate) => {
      replaceGraph(template.nodes, template.edges);
      requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    },
    [replaceGraph, fitView]
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      {/* Mounted once the saved draft is read, so the first fit-to-view already includes it. */}
      {hydrated && (
        <CanvasFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDelete={onDelete}
          draggedShape={draggedShape}
          onDragFinished={() => setDraggedShape(null)}
          history={history}
        />
      )}
      {hydrated && nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold text-copy-secondary">Start drawing your system</p>
            <p className="text-sm text-copy-muted">Drag shapes onto the canvas, or open Templates for a starter design.</p>
          </div>
        </div>
      )}
      <ShapePanel onDragStart={setDraggedShape} onDragEnd={() => setDraggedShape(null)} />
      <StarterTemplatesModal isOpen={dialog === "templates"} onClose={closeDialog} onImport={handleImportTemplate} />
    </div>
  );
};

/*
  The signed-out canvas at `/`: the same canvas as a project, without the room. Everything is kept in
  this browser (see `useLocalFlow`); there is no server, no collaborators and no AI until the visitor
  signs in and saves it as a project.
 */
const ScratchCanvas = () => (
  <ReactFlowProvider>
    <Scratch />
  </ReactFlowProvider>
);

export default ScratchCanvas;
