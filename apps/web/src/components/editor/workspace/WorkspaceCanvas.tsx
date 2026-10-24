"use client";

import { useCallback, useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { ProjectSummary } from "@repo/types";
import {
  useCanRedo,
  useCanUndo,
  useFlow,
  useRedo,
  useRoomClient,
  useUndo,
  useUpdateMyPresence,
} from "@/lib/realtime/react";
import { clearGuestDraft, loadGuestDraft } from "@/lib/guestDraft";
import { useCanvasSaveStore } from "@/store/canvasSave.store";
import { useEditorStore } from "@/store/editor.store";
import type { CanvasFlowEdge, CanvasFlowNode, DraggedShape } from "@/types";
import CanvasFlow from "../canvas/CanvasFlow";
import CursorsLayer from "../canvas/CursorsLayer";
import RoomPresence from "../canvas/RoomPresence";
import ShapePanel from "../canvas/ShapePanel";
import StarterTemplatesModal from "../canvas/StarterTemplatesModal";
import type { CanvasTemplate } from "../canvas/starter-templates";

const FIT_VIEW_OPTIONS = { duration: 400, padding: 0.2, maxZoom: 1 };

/*
  Owns the room's flow state (via `useFlow` connected to the in-house Yjs CRDT room)
  - loading: authoritative on the server (seeded from .ydoc or snapshot automatically);
  - autosave: authoritative on the server (debounced and compacted);
  - template import: replaces the canvas collaboratively through Yjs transaction.
 */
const WorkspaceCanvas = ({ project }: { project: ProjectSummary }) => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete, replaceGraph } = useFlow();
  const { fitView } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  const client = useRoomClient();
  const dialog = useEditorStore((state) => state.dialog);
  const closeDialog = useEditorStore((state) => state.closeDialog);
  const registerSave = useCanvasSaveStore((state) => state.register);
  const pendingImport = useEditorStore((state) => state.pendingImport);
  const setPendingImport = useEditorStore((state) => state.setPendingImport);
  const updateMyPresence = useUpdateMyPresence();
  const history = {
    undo: useUndo(),
    redo: useRedo(),
    canUndo: useCanUndo(),
    canRedo: useCanRedo(),
  };

  const [draggedShape, setDraggedShape] = useState<DraggedShape | null>(null);

  useEffect(() => {
    registerSave(async () => {
      if (!client.saveNow()) throw new Error("Not connected");
    });
    return () => registerSave(null);
  }, [client, registerSave]);

  // "Save" on the signed-out/scratch canvas creates this project; its drawing arrives here. The room
  // has synced by now (RoomGate), so an empty document means a brand-new project to fill.
  useEffect(() => {
    if (pendingImport?.projectId !== project.id) return;
    const draft = loadGuestDraft();
    const roomIsEmpty = client.getSnapshot().nodes.length === 0;
    if (draft && roomIsEmpty) {
      replaceGraph(draft.nodes, draft.edges);
      clearGuestDraft();
      requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    }
    setPendingImport(null);
  }, [pendingImport, project.id, client, replaceGraph, fitView, setPendingImport]);

  const handleCursorMove = useCallback(
    (cursor: { x: number; y: number } | null) => updateMyPresence({ cursor }),
    [updateMyPresence]
  );

  const handleImportTemplate = useCallback(
    (template: CanvasTemplate) => {
      // One transaction: every collaborator sees the swap at once and Undo reverts all of it in one step.
      replaceGraph(template.nodes, template.edges);
      requestAnimationFrame(() => void fitView(FIT_VIEW_OPTIONS));
    },
    [replaceGraph, fitView]
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
        history={history}
        onCursorMove={handleCursorMove}
      >
        <CursorsLayer />
      </CanvasFlow>
      <RoomPresence />
      <ShapePanel onDragStart={setDraggedShape} onDragEnd={() => setDraggedShape(null)} />
      <StarterTemplatesModal isOpen={dialog === "templates"} onClose={closeDialog} onImport={handleImportTemplate} />
    </div>
  );
};

export default WorkspaceCanvas;
