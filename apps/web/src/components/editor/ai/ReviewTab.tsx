"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useReactFlow, useStore } from "@xyflow/react";
import {
  analyzeGraph,
  type AiRunStarted,
  type Finding,
  type ProjectSummary,
} from "@repo/types";
import { useAiFeeds } from "@/hooks/ai/useAiFeeds";
import { useApplyFix } from "@/hooks/ai/useApplyFix";
import { useStartReview } from "@/hooks/ai/useStartReview";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";
import ReviewView from "./ReviewView";
import RunWatcher from "./RunWatcher";
import UsagePanel from "./UsagePanel";

const MIN_NODES_TO_REVIEW = 2;

/*
  Two layers of review. The health ring and findings come from graph algorithms and run instantly on
  every change, with no model involved. "Run AI review" adds a model's judgement on top: prioritised
  recommendations, each with the canvas edits that implement it, applied with one click (and undoable).
 */
const ReviewTab = ({ project }: { project: ProjectSummary }) => {
  const queryClient = useQueryClient();
  const { latestReview, latestStatus, isRoomGenerating } = useAiFeeds();
  const { getNodes, getEdges, setNodes, fitView } = useReactFlow<
    CanvasFlowNode,
    CanvasFlowEdge
  >();
  const startReview = useStartReview();
  const applyFix = useApplyFix();
  const [activeRun, setActiveRun] = useState<AiRunStarted | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // A string that changes only when the diagram's content does, so dragging nodes around doesn't re-run the analysis.
  const signature = useStore(
    (state) =>
      `${state.nodes.map((node) => `${node.id}|${node.data?.label}|${node.data?.shape}`).join(";")}#${state.edges.map((edge) => `${edge.source}>${edge.target}|${edge.data?.label ?? ""}`).join(";")}`,
  );
  const analysis = useMemo(
    () =>
      analyzeGraph({
        nodes: getNodes().map((node) => ({
          id: node.id,
          label: node.data.label,
          shape: node.data.shape,
        })),
        edges: getEdges().map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.data?.label,
        })),
      }),
    // `signature` is the dependency that matters; the getters are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );

  const isGenerating =
    Boolean(activeRun) || isRoomGenerating || startReview.isPending;
  const handleRunFinished = useCallback(() => setActiveRun(null), []);

  // Refresh the usage numbers whenever a run settles.
  const settledId = latestStatus && !isRoomGenerating ? latestStatus.id : null;
  const lastSettled = useRef<string | null>(null);
  useEffect(() => {
    if (settledId && settledId !== lastSettled.current) {
      lastSettled.current = settledId;
      void queryClient.invalidateQueries({
        queryKey: ["ai-usage", project.id],
      });
    }
  }, [settledId, queryClient, project.id]);

  const focus = (finding: Finding) => {
    if (finding.nodeIds.length === 0) return;
    const ids = new Set(finding.nodeIds);
    setNodes((nodes) =>
      nodes.map((node) => ({ ...node, selected: ids.has(node.id) })),
    );
    void fitView({
      nodes: finding.nodeIds.map((id) => ({ id })),
      padding: 0.6,
      duration: 400,
      maxZoom: 1.1,
    });
  };

  const runReview = () => {
    setNotice(null);
    startReview.mutate(
      { roomId: project.id },
      {
        onSuccess: (response) => setActiveRun(response.data),
        onError: (error) => setNotice(error.message),
      },
    );
  };

  const apply = (recommendationId: string) => {
    if (!latestReview) return;
    setNotice(null);
    setApplyingId(recommendationId);
    applyFix.mutate(
      { roomId: project.id, reviewRunId: latestReview.runId, recommendationId },
      {
        onError: (error) => setNotice(error.message),
        onSettled: () => setApplyingId(null),
      },
    );
  };

  const findings = analysis.findings;
  const canReview = analysis.stats.nodes >= MIN_NODES_TO_REVIEW;

  return (
    <>
      {activeRun && (
        <RunWatcher run={activeRun} onFinished={handleRunFinished} />
      )}
      <ReviewView
        analysis={analysis}
        review={latestReview}
        isGenerating={isGenerating}
        canReview={canReview}
        notice={notice}
        applyingId={applyingId}
        showAll={showAll}
        onToggleShowAll={() => setShowAll((value) => !value)}
        onFocus={focus}
        onRunReview={runReview}
        onApply={apply}
      >
        <UsagePanel projectId={project.id} />
      </ReviewView>
    </>
  );
};

export default ReviewTab;
