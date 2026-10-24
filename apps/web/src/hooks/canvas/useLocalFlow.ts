"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { CUSTOM_EDGE_TYPE } from "@repo/types";
import { loadGuestDraft, saveGuestDraft } from "@/lib/guestDraft";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";

interface Graph {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
}

const EMPTY_GRAPH: Graph = { nodes: [], edges: [] };
const HISTORY_LIMIT = 50;
const PERSIST_DEBOUNCE_MS = 500;
// Typing a label fires a change per keystroke; one undo step per burst, not per letter.
const TEXT_EDIT_STEP_MS = 1000;

/*
  The signed-out twin of `useFlow`: the same surface (nodes, edges, change handlers, replaceGraph) over
  plain React state instead of the Yjs room, persisted to localStorage instead of the server. It has no
  collaborators, so history is a simple snapshot stack rather than a CRDT undo manager.
 */
export const useLocalFlow = () => {
  const [graph, setGraph] = useState<Graph>(EMPTY_GRAPH);
  const [hydrated, setHydrated] = useState(false);
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });

  const graphRef = useRef<Graph>(EMPTY_GRAPH);
  const past = useRef<Graph[]>([]);
  const future = useRef<Graph[]>([]);
  const stepOpenThisTick = useRef(false);
  const gestureActive = useRef(false);
  const lastTextEditAt = useRef(0);

  const apply = useCallback((next: Graph) => {
    graphRef.current = next;
    setGraph(next);
  }, []);

  const syncHistoryFlags = useCallback(() => {
    setHistoryFlags({ canUndo: past.current.length > 0, canRedo: future.current.length > 0 });
  }, []);

  // Records the state *before* a change. A delete removes a node and its edges in two calls in the same
  // tick; only the first records, so the whole delete is one undo step.
  const recordStep = useCallback(() => {
    if (stepOpenThisTick.current) return;
    stepOpenThisTick.current = true;
    queueMicrotask(() => {
      stepOpenThisTick.current = false;
    });
    past.current.push(graphRef.current);
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  // Hydrate after mount (localStorage doesn't exist during server rendering).
  useEffect(() => {
    const draft = loadGuestDraft();
    if (draft) apply(draft);
    setHydrated(true);
  }, [apply]);

  // Persist — debounced, plus a flush when the tab goes away so the last edit isn't lost.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => saveGuestDraft(graph), PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [graph, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const flush = () => saveGuestDraft(graphRef.current);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [hydrated]);

  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === "remove" || change.type === "add") {
          recordStep();
        } else if (change.type === "position" || change.type === "dimensions") {
          // A drag or resize is one step, recorded when the gesture starts.
          const active = change.type === "position" ? change.dragging : change.resizing;
          if (active && !gestureActive.current) {
            gestureActive.current = true;
            recordStep();
          } else if (active === false) {
            gestureActive.current = false;
          }
        } else if (change.type === "replace") {
          const now = Date.now();
          if (now - lastTextEditAt.current > TEXT_EDIT_STEP_MS) recordStep();
          lastTextEditAt.current = now;
        }
      }
      const current = graphRef.current;
      apply({ ...current, nodes: applyNodeChanges(changes, current.nodes) });
    },
    [apply, recordStep]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<CanvasFlowEdge>[]) => {
      for (const change of changes) {
        if (change.type === "remove" || change.type === "add") recordStep();
        else if (change.type === "replace") {
          const now = Date.now();
          if (now - lastTextEditAt.current > TEXT_EDIT_STEP_MS) recordStep();
          lastTextEditAt.current = now;
        }
      }
      const current = graphRef.current;
      apply({ ...current, edges: applyEdgeChanges(changes, current.edges) });
    },
    [apply, recordStep]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      recordStep();
      const newEdge: CanvasFlowEdge = {
        id: `e_${connection.source}_${connection.target}_${Date.now().toString(36)}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        type: CUSTOM_EDGE_TYPE,
        data: { label: "" },
      };
      const current = graphRef.current;
      apply({ ...current, edges: [...current.edges, newEdge] });
    },
    [apply, recordStep]
  );

  // React Flow reports the removed nodes and edges through the change handlers too, so there is
  // nothing left to do here — it only exists to match `useFlow`'s surface.
  const onDelete = useCallback(() => {}, []);

  const replaceGraph = useCallback(
    (nextNodes: CanvasFlowNode[], nextEdges: CanvasFlowEdge[]) => {
      recordStep();
      apply({ nodes: nextNodes, edges: nextEdges });
    },
    [apply, recordStep]
  );

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(graphRef.current);
    apply(previous);
    syncHistoryFlags();
  }, [apply, syncHistoryFlags]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(graphRef.current);
    apply(next);
    syncHistoryFlags();
  }, [apply, syncHistoryFlags]);

  return {
    nodes: graph.nodes,
    edges: graph.edges,
    hydrated,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onDelete,
    replaceGraph,
    history: { undo, redo, canUndo: historyFlags.canUndo, canRedo: historyFlags.canRedo },
  };
};
