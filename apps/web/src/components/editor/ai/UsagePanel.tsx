"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiUsage } from "@/hooks/ai/useAiUsage";
import { cn } from "@/lib/utils";

const seconds = (ms: number | null) =>
  ms === null ? "—" : `${(ms / 1000).toFixed(1)}s`;
const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-surface-border-subtle bg-base px-3 py-2">
    <p className="font-mono text-base font-bold tabular-nums text-copy-primary">
      {value}
    </p>
    <p className="font-mono text-[10px] uppercase tracking-wider text-copy-muted">
      {label}
    </p>
  </div>
);

// How this project's AI runs have gone: which models answered, how fast, how often a backup was needed.
const UsagePanel = ({ projectId }: { projectId: string }) => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useAiUsage(projectId);
  const usage = data?.data;

  return (
    <section className="rounded-2xl border border-surface-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50"
      >
        <span className="font-mono text-xs font-semibold text-copy-primary">
          AI usage
        </span>
        <span className="flex items-center gap-2 font-mono text-[11px] text-copy-muted">
          {usage ? `${usage.runs} run${usage.runs === 1 ? "" : "s"}` : ""}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-surface-border px-4 pb-4 pt-3">
          {isLoading || !usage ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : usage.runs === 0 ? (
            <p className="text-xs text-copy-muted">
              No AI runs yet. Ask for a design and the stats will appear here.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Avg latency" value={seconds(usage.avgLatencyMs)} />
                <Stat
                  label="Backup used"
                  value={`${usage.fellBack}/${usage.runs}`}
                />
                <Stat label="Tokens in" value={compact(usage.inputTokens)} />
                <Stat label="Tokens out" value={compact(usage.outputTokens)} />
              </div>

              {usage.byProvider.length > 0 && (
                <ul className="space-y-1.5">
                  {usage.byProvider.map((entry) => (
                    <li
                      key={`${entry.provider}/${entry.model}`}
                      className="flex items-center justify-between gap-2 font-mono text-[11px]"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 text-copy-secondary">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            entry.provider === "nvidia"
                              ? "bg-state-success"
                              : "bg-ai-text",
                          )}
                        />
                        <span className="truncate">
                          {entry.model.split("/").pop()}
                        </span>
                      </span>
                      <span className="shrink-0 text-copy-muted">
                        {entry.runs} · {seconds(entry.avgLatencyMs)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="font-mono text-[10px] text-copy-faint">
                {usage.completed} done · {usage.failed} failed ·{" "}
                {usage.cancelled} stopped
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default UsagePanel;
