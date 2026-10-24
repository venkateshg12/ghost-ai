"use client";

import { useCallback, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { isFreePoint } from "@repo/types";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";
import {
  downloadJson,
  downloadPng,
  downloadText,
  mermaidOf,
} from "@/lib/exportDiagram";

type ExportStatus =
  | { kind: "idle" }
  | { kind: "working"; what: string }
  | { kind: "done"; what: string }
  | { kind: "error"; message: string };

const FILE_BASE = "plano-diagram";

/*
  Canvas-wide actions that work on the nodes and edges in the browser: lay the diagram out neatly, and
  export it. Both go through the same React Flow state everything else uses, so Tidy is undoable like
  any other edit.
 */
export const useDiagramTools = () => {
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow<
    CanvasFlowNode,
    CanvasFlowEdge
  >();
  const [status, setStatus] = useState<ExportStatus>({ kind: "idle" });

  const flash = useCallback((what: string) => {
    setStatus({ kind: "done", what });
    window.setTimeout(() => setStatus({ kind: "idle" }), 1800);
  }, []);

  const fail = useCallback((error: unknown) => {
    setStatus({
      kind: "error",
      message: error instanceof Error ? error.message : "Export failed.",
    });
    window.setTimeout(() => setStatus({ kind: "idle" }), 3000);
  }, []);

  // Layered left-to-right layout; the dagre-based module is loaded the first time it is used.
  const tidy = useCallback(async () => {
    const all = getNodes();
    // Free-standing lines are annotations: they stay where they were drawn.
    const nodes = all.filter((node) => !isFreePoint(node.data?.shape));
    if (nodes.length === 0) return;
    const { layoutGraph } = await import("@repo/types/layout");

    const sized = nodes.map((node) => ({
      id: node.id,
      width: node.measured?.width ?? (Number(node.style?.width) || 140),
      height: node.measured?.height ?? (Number(node.style?.height) || 60),
    }));
    // Keep the diagram where it is: the new layout starts at the old top-left.
    const positions = layoutGraph(sized, getEdges(), {
      originX: Math.min(...nodes.map((node) => node.position.x)),
      originY: Math.min(...nodes.map((node) => node.position.y)),
    });
    setNodes((current) =>
      current.map((node) => ({
        ...node,
        position: positions.get(node.id) ?? node.position,
      })),
    );
    window.requestAnimationFrame(
      () => void fitView({ duration: 400, padding: 0.2 }),
    );
  }, [getNodes, getEdges, setNodes, fitView]);

  const copyMermaid = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mermaidOf(getNodes(), getEdges()));
      flash("Mermaid copied");
    } catch (error) {
      fail(error);
    }
  }, [getNodes, getEdges, flash, fail]);

  const exportMermaid = useCallback(() => {
    downloadText(mermaidOf(getNodes(), getEdges()), `${FILE_BASE}.mmd`);
    flash("Mermaid saved");
  }, [getNodes, getEdges, flash]);

  const exportJson = useCallback(() => {
    downloadJson(getNodes(), getEdges(), `${FILE_BASE}.json`);
    flash("JSON saved");
  }, [getNodes, getEdges, flash]);

  const exportPng = useCallback(async () => {
    setStatus({ kind: "working", what: "Rendering PNG…" });
    try {
      await downloadPng(getNodes(), `${FILE_BASE}.png`);
      flash("PNG saved");
    } catch (error) {
      fail(error);
    }
  }, [getNodes, flash, fail]);

  return { status, tidy, copyMermaid, exportMermaid, exportJson, exportPng };
};
