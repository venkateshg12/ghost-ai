"use client";

import { useEffect } from "react";
import { useRealtimeRun } from "@trigger.dev/react-hooks";
import type { AiRunStarted } from "@repo/types";

// Statuses after which a run will not change again.
const FINAL_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CRASHED",
  "CANCELED",
  "SYSTEM_FAILURE",
  "EXPIRED",
  "TIMED_OUT",
]);

interface RunWatcherProps {
  run: AiRunStarted;
  onFinished: (outcome: { succeeded: boolean; error?: string }) => void;
}

/*
  Subscribes to one Trigger.dev run with the read-only token the API returned, and reports when it
  settles. Rendered only while a run is in flight, so the hook is never called without a run id. It
  draws nothing — progress text for the whole room comes from `ai-status-feed`.
 */
const RunWatcher = ({ run, onFinished }: RunWatcherProps) => {
  const { run: realtimeRun, error } = useRealtimeRun(run.runId, {
    accessToken: run.publicAccessToken,
  });

  useEffect(() => {
    if (error) {
      onFinished({ succeeded: false, error: error.message });
      return;
    }
    if (realtimeRun && FINAL_STATUSES.has(realtimeRun.status)) {
      onFinished({
        succeeded: realtimeRun.status === "COMPLETED",
        error: realtimeRun.error?.message,
      });
    }
  }, [realtimeRun, error, onFinished]);

  return null;
};

export default RunWatcher;
