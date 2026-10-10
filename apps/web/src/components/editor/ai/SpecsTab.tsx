"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Eye, FileText, Loader2, Sparkles } from "lucide-react";
import type {
  AiRunStarted,
  ProjectSpecSummary,
  ProjectSummary,
} from "@repo/types";
import { specDownloadPath } from "@/api/project";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiFeeds } from "@/hooks/ai/useAiFeeds";
import { useStartSpec } from "@/hooks/ai/useStartSpec";
import { useGetSpecs } from "@/hooks/spec/useGetSpecs";
import { downloadFromApi } from "@/lib/download";
import queryClient from "@/lib/queryClient";
import RunWatcher from "./RunWatcher";
import SpecPreviewModal from "./SpecPreviewModal";

/*
  Generate a spec from the current canvas (and the room's chat), then preview or download past ones.
  The list refreshes when the room's status feed reports a finished spec, so a spec started by one
  collaborator shows up for everyone.
 */
const SpecsTab = ({ project }: { project: ProjectSummary }) => {
  const { chat, latestStatus, isRoomGenerating } = useAiFeeds();
  const { data: specs = [], isLoading } = useGetSpecs(project.id);
  const startSpec = useStartSpec();
  const [activeRun, setActiveRun] = useState<AiRunStarted | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ProjectSpecSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const isGenerating =
    Boolean(activeRun) || isRoomGenerating || startSpec.isPending;

  // The starter learns the outcome straight from Trigger.dev, even if a feed message is missed.
  const handleRunFinished = useCallback(
    ({ succeeded, error }: { succeeded: boolean; error?: string }) => {
      setActiveRun(null);
      if (succeeded) {
        void queryClient.invalidateQueries({ queryKey: ["specs", project.id] });
      } else {
        setRunError(error ?? "Spec generation failed. Please try again.");
      }
    },
    [project.id],
  );

  useEffect(() => {
    if (latestStatus?.kind === "spec" && latestStatus.step === "complete") {
      void queryClient.invalidateQueries({ queryKey: ["specs", project.id] });
    }
  }, [latestStatus?.id, latestStatus?.kind, latestStatus?.step, project.id]);

  const handleGenerate = () => {
    setRunError(null);
    startSpec.mutate(
      {
        roomId: project.id,
        chatHistory: chat.slice(-50).map((message) => ({
          role: message.role,
          content: message.content.slice(0, 4000),
        })),
      },
      { onSuccess: (response) => setActiveRun(response.data) },
    );
  };

  const handleDownload = async (spec: ProjectSpecSummary) => {
    setDownloadingId(spec.id);
    try {
      await downloadFromApi(
        specDownloadPath(spec.projectId, spec.id),
        spec.fileName,
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col space-y-4 overflow-y-auto p-4">
      {activeRun && (
        <RunWatcher run={activeRun} onFinished={handleRunFinished} />
      )}
      <Button
        type="button"
        disabled={isGenerating}
        onClick={handleGenerate}
        className="h-9 w-full gap-2 rounded-xl bg-ai font-mono text-xs font-semibold text-white shadow-md hover:bg-ai/90"
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span>{isGenerating ? "Generating Spec..." : "Generate Spec"}</span>
      </Button>

      {isGenerating && latestStatus?.text && (
        <p className="rounded-xl border border-ai/30 bg-ai/10 px-3 py-2 font-mono text-[11px] text-ai-text">
          {latestStatus.text}
        </p>
      )}
      {(startSpec.error || runError) && (
        <p className="text-[11px] text-state-error">
          {startSpec.error?.message ?? runError}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : specs.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-2xl border border-surface-border-subtle bg-elevated/40 p-6 text-center">
          <FileText className="h-8 w-8 text-copy-muted opacity-50" />
          <div className="space-y-1">
            <p className="font-mono text-xs font-semibold text-copy-primary">
              No specifications yet
            </p>
            <p className="text-[11px] text-copy-muted">
              Generate a technical spec from the architecture on your canvas.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {specs.map((spec) => (
            <li
              key={spec.id}
              className="space-y-3 rounded-2xl border border-surface-border bg-elevated p-3.5 shadow-md transition-colors hover:border-ai/40"
            >
              <button
                type="button"
                onClick={() => setPreview(spec)}
                className="flex w-full items-center gap-2.5 text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-ai/30 bg-ai/15 text-ai-text">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate font-mono text-xs font-bold text-copy-primary">
                    {spec.fileName}
                  </h4>
                  <p className="font-mono text-[10px] text-copy-muted">
                    {new Date(spec.createdAt).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2 border-t border-surface-border-subtle/50 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreview(spec)}
                  className="h-7 flex-1 gap-1 border-surface-border-subtle font-mono text-xs text-copy-secondary"
                >
                  <Eye className="h-3 w-3" />
                  <span>Preview</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={downloadingId === spec.id}
                  onClick={() => void handleDownload(spec)}
                  className="h-7 flex-1 gap-1 border-surface-border-subtle font-mono text-xs text-brand hover:bg-brand-dim"
                >
                  {downloadingId === spec.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  <span>Download</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SpecPreviewModal spec={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

export default SpecsTab;
