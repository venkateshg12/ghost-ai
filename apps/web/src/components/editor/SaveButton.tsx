"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoomStatus } from "@/lib/realtime/react";
import { useCanvasSaveStore } from "@/store/canvasSave.store";

type SaveDisplayStatus = "idle" | "saving" | "saved" | "error";
const LABELS: Record<SaveDisplayStatus, string> = {
  idle: "Save",
  saving: "Saving...",
  saved: "Saved",
  error: "Error",
};

// Manual save through the room client; reflects the authoritative save state from the server.
// The server answers a save request with a `saved` frame. If none comes, say so instead of spinning forever.
const SAVE_TIMEOUT_MS = 8000;

const SaveButton = () => {
  const saveNow = useCanvasSaveStore((state) => state.saveNow);
  const status = useRoomStatus();
  const [displayStatus, setDisplayStatus] = useState<SaveDisplayStatus>("idle");
  const lastSavedAtRef = useRef<number | null>(status.lastSavedAt);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showResult = (result: SaveDisplayStatus) => {
    clearTimeout(saveTimeoutRef.current);
    clearTimeout(resetTimerRef.current);
    setDisplayStatus(result);
    resetTimerRef.current = setTimeout(() => setDisplayStatus("idle"), 2500);
  };

  // A save finished on the server (autosave, or the one we asked for).
  useEffect(() => {
    if (status.lastSavedAt && status.lastSavedAt !== lastSavedAtRef.current) {
      lastSavedAtRef.current = status.lastSavedAt;
      showResult("saved");
    }
  }, [status.lastSavedAt]);

  // The server reported that saving failed.
  useEffect(() => {
    if (status.saveError) showResult("error");
  }, [status.saveError]);

  useEffect(
    () => () => {
      clearTimeout(resetTimerRef.current);
      clearTimeout(saveTimeoutRef.current);
    },
    []
  );

  const handleSave = async () => {
    if (!saveNow || displayStatus === "saving") return;
    clearTimeout(resetTimerRef.current);
    setDisplayStatus("saving");
    try {
      await saveNow();
      saveTimeoutRef.current = setTimeout(() => showResult("error"), SAVE_TIMEOUT_MS);
    } catch {
      showResult("error");
    }
  };

  const Icon =
    displayStatus === "saving" ? Loader2 : displayStatus === "saved" ? Check : displayStatus === "error" ? AlertCircle : Save;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!saveNow || displayStatus === "saving"}
      onClick={() => void handleSave()}
      className={
        displayStatus === "error"
          ? "h-8 gap-1.5 border-state-error/40 px-3 font-mono text-xs text-state-error"
          : displayStatus === "saved"
            ? "h-8 gap-1.5 border-state-success/40 px-3 font-mono text-xs text-state-success"
            : "h-8 gap-1.5 border-surface-border-subtle px-3 font-mono text-xs text-copy-secondary hover:text-copy-primary"
      }
    >
      <Icon className={displayStatus === "saving" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
      <span>{LABELS[displayStatus]}</span>
    </Button>
  );
};

export default SaveButton;
