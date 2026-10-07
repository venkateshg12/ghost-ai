"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { useLiveblocksFlow } from "@liveblocks/react-flow";
import type { ProjectSummary } from "@repo/types";
import { getCanvas } from "@/api/project";
import { useCanvasAutosave } from "@/hooks/canvas/useCanvasAutosave";
import { useCanvasSaveStore } from "@/store/canvasSave.store";
import { useEditorStore } from "@/store/editor.store";
import type { CanvasFlowEdge, CanvasFlowNode, DraggedShape } from "@/types";
import CanvasFlow from "../canvas/CanvasFlow";
import RoomPresence from "../canvas/RoomPresence";
import ShapePanel from "../canvas/ShapePanel";
import StarterTemplatesModal from "../canvas/StarterTemplatesModal";
import type { CanvasTemplate } from "../canvas/starter-templates";

const FIT_VIEW_OPTIONS = { duration: 400, padding: 0.2, maxZoom: 1 };

/*
  Owns the room's flow state (one `useLiveblocksFlow` for the whole workspace) and the persistence
  around it:
  - initial load: only when the room is empty, seed it from the saved snapshot — a room that already
    has nodes is live collaboration and is never overwritten;
  - autosave: debounced snapshots once that decision is made;
  - template import: replaces the canvas through the same collaborative state.
 */
const WorkspaceCanvas = ({ project }: { project: ProjectSummary }) => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } = useLiveblocksFlow<CanvasFlowNode, CanvasFlowEdge>({
    suspense: true,
    nodes: { initial: [] },
    edges: { initial: [] },
  });
  const { setNodes, setEdges, fitView } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const dialog = useEditorStore((state) => state.dialog);
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const registerSave = useCanvasSaveStore((state) => state.register);

  const [draggedShape, setDraggedShape] = useState<DraggedShape | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const loadStarted = useRef(false);

  useEffect(() => {
    if (loadStarted.current) return;
    loadStarted.current = true;

    if (nodes.length > 0 || edges.length > 0) {
      setInitialLoadDone(true);
      return;
    }

    let cancelled = false;
    getCanvas(project.id)
      .then(({ data: saved }) => {
        if (cancelled || saved.nodes.length === 0) return;
        setNodes(saved.nodes as CanvasFlowNode[]);
        setEdges(saved.edges as CanvasFlowEdge[]);
        requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
      })
      .catch((error) => console.error("Saved canvas could not be loaded:", error))
      .finally(() => {
        if (!cancelled) setInitialLoadDone(true);
      });

    return () => {
      cancelled = true;
    };
    // Runs once per room: the decision is about the room's state at the moment it was opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { saveNow } = useCanvasAutosave({ projectId: project.id, nodes, edges, enabled: initialLoadDone });

  useEffect(() => {
    registerSave(saveNow);
    return () => registerSave(null);
  }, [registerSave, saveNow]);

  const handleImportTemplate = useCallback(
    (template: CanvasTemplate) => {
      // Edges first, so none ever points at a node that has just been removed.
      setEdges([]);
      setNodes(template.nodes);
      setEdges(template.edges);
      requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    },
    [setNodes, setEdges, fitView]
  );

  return (
    <div className="relative flex-1 overflow-hidden">
      <CanvasFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        draggedShape={draggedShape}
        onDragFinished={() => setDraggedShape(null)}
      />
      <RoomPresence />
      <ShapePanel onDragStart={setDraggedShape} onDragEnd={() => setDraggedShape(null)} />
      <StarterTemplatesModal isOpen={dialog === "templates"} onClose={closeDialog} onImport={handleImportTemplate} />
    </div>
  );
};

export default WorkspaceCanvas;
