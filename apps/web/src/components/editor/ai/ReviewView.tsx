"use client";

import type { ReactNode } from "react";
import { Check, Loader2, ScanSearch, Wrench } from "lucide-react";
import type { Analysis, Finding, Severity } from "@repo/types";
import { Button } from "@/components/ui/button";
import type { ReviewMessage } from "@/hooks/ai/useAiFeeds";
import { cn } from "@/lib/utils";
import HealthRing from "./HealthRing";

const SEVERITY_STYLE: Record<Severity, string> = {
  high: "border-state-error/40 bg-state-error/10 text-state-error",
  medium: "border-state-warning/40 bg-state-warning/10 text-state-warning",
  low: "border-surface-border-subtle bg-subtle text-copy-secondary",
};

const SeverityTag = ({ severity }: { severity: Severity }) => (
  <span
    className={cn(
      "shrink-0 rounded-xl border px-1.5 py-px font-mono text-[10px] font-semibold uppercase",
      SEVERITY_STYLE[severity],
    )}
  >
    {severity}
  </span>
);

export const FINDINGS_SHOWN = 4;

interface ReviewViewProps {
  analysis: Analysis;
  review: ReviewMessage | null;
  isGenerating: boolean;
  canReview: boolean;
  notice: string | null;
  applyingId: string | null;
  showAll: boolean;
  onToggleShowAll: () => void;
  onFocus: (finding: Finding) => void;
  onRunReview: () => void;
  onApply: (recommendationId: string) => void;
  /** The usage panel, rendered last. */
  children?: ReactNode;
}

// The Review tab's layout, with no data fetching, so it can be previewed and tested on its own.
const ReviewView = ({
  analysis,
  review: latestReview,
  isGenerating,
  canReview,
  notice,
  applyingId,
  showAll,
  onToggleShowAll,
  onFocus,
  onRunReview,
  onApply,
  children,
}: ReviewViewProps) => {
  const findings = showAll
    ? analysis.findings
    : analysis.findings.slice(0, FINDINGS_SHOWN);

  return (
    <div className="flex flex-1 flex-col space-y-4 overflow-y-auto p-4">
      <section className="flex items-center gap-4 rounded-2xl border border-surface-border bg-surface p-4">
        {analysis.isEmpty ? (
          <p className="text-xs leading-relaxed text-copy-muted">
            The canvas is empty. Add components, or ask the AI to design
            something, to see this architecture&apos;s health.
          </p>
        ) : (
          <>
            <HealthRing score={analysis.score} grade={analysis.grade} />
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-xs font-semibold text-copy-primary">
                Architecture health
              </p>
              <p className="font-mono text-[11px] text-copy-muted">
                {analysis.stats.nodes} components · {analysis.stats.edges}{" "}
                connections
              </p>
              <p className="text-[11px] leading-snug text-copy-muted">
                {analysis.findings.length === 0
                  ? "No issues found by the automated checks."
                  : `${analysis.findings.length} issue${analysis.findings.length === 1 ? "" : "s"} found automatically.`}
              </p>
            </div>
          </>
        )}
      </section>

      {findings.length > 0 && (
        <section className="space-y-2">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-copy-muted">
            Findings
          </h4>
          <ul className="space-y-2">
            {findings.map((finding) => (
              <li key={finding.id}>
                <button
                  type="button"
                  onClick={() => onFocus(finding)}
                  disabled={finding.nodeIds.length === 0}
                  title={
                    finding.nodeIds.length ? "Show on the canvas" : undefined
                  }
                  className="w-full space-y-1 rounded-xl border border-surface-border bg-surface px-3 py-2.5 text-left transition-colors enabled:hover:border-surface-border-subtle enabled:hover:bg-elevated/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50 disabled:cursor-default"
                >
                  <span className="flex items-start gap-2">
                    <SeverityTag severity={finding.severity} />
                    <span className="text-xs font-medium leading-snug text-copy-primary">
                      {finding.title}
                    </span>
                  </span>
                  <span className="block text-[11px] leading-relaxed text-copy-muted">
                    {finding.detail}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {analysis.findings.length > FINDINGS_SHOWN && (
            <button
              type="button"
              onClick={() => onToggleShowAll()}
              className="font-mono text-[11px] text-ai-text hover:underline"
            >
              {showAll
                ? "Show fewer"
                : `Show ${analysis.findings.length - FINDINGS_SHOWN} more`}
            </button>
          )}
        </section>
      )}

      <Button
        type="button"
        onClick={onRunReview}
        disabled={isGenerating || !canReview}
        className="h-9 w-full gap-2 rounded-xl bg-ai font-mono text-xs font-semibold text-white shadow-md hover:bg-ai/90"
      >
        {isGenerating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScanSearch className="h-3.5 w-3.5" />
        )}
        <span>
          {isGenerating
            ? "Working…"
            : canReview
              ? "Run AI review"
              : "Add components to review"}
        </span>
      </Button>
      {notice && <p className="text-[11px] text-state-error">{notice}</p>}

      {latestReview && (
        <section className="space-y-3 rounded-2xl border border-ai/30 bg-ai/5 p-4">
          <div className="space-y-1.5">
            <h4 className="font-mono text-xs font-semibold text-copy-primary">
              AI review
            </h4>
            <p className="text-xs leading-relaxed text-copy-secondary">
              {latestReview.summary}
            </p>
            {latestReview.meta && (
              <p className="font-mono text-[10px] text-copy-faint">
                {latestReview.meta.label} ·{" "}
                {(latestReview.meta.latencyMs / 1000).toFixed(1)}s
                {latestReview.meta.fellBack ? " · backup model" : ""}
              </p>
            )}
          </div>

          <ul className="space-y-2.5">
            {latestReview.recommendations.map((recommendation) => {
              const canApply =
                recommendation.operations.length > 0 && !recommendation.applied;
              return (
                <li
                  key={recommendation.id}
                  className="space-y-2 rounded-xl border border-surface-border bg-base p-3"
                >
                  <div className="flex items-start gap-2">
                    <SeverityTag severity={recommendation.severity} />
                    <p className="text-xs font-medium leading-snug text-copy-primary">
                      {recommendation.title}
                    </p>
                  </div>
                  <p className="text-[11px] leading-relaxed text-copy-muted">
                    {recommendation.rationale}
                  </p>
                  {recommendation.applied ? (
                    <p className="flex items-center gap-1.5 font-mono text-[11px] text-state-success">
                      <Check className="h-3.5 w-3.5" /> Applied
                    </p>
                  ) : canApply ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onApply(recommendation.id)}
                      disabled={applyingId !== null || isGenerating}
                      className="h-7 gap-1.5 font-mono text-[11px]"
                    >
                      {applyingId === recommendation.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wrench className="h-3 w-3" />
                      )}
                      Apply fix · {recommendation.operations.length} change
                      {recommendation.operations.length === 1 ? "" : "s"}
                    </Button>
                  ) : (
                    <p className="font-mono text-[10px] text-copy-faint">
                      Advice only — no automatic fix
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="font-mono text-[10px] text-copy-faint">
            Every applied fix can be undone from the chat.
          </p>
        </section>
      )}

      {children}
    </div>
  );
};

export default ReviewView;
