"use client";

import { AlertCircle, Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasSaveStore } from "@/store/canvasSave.store";
import { useEditorStore } from "@/store/editor.store";

const LABELS = { idle: "Save", saving: "Saving...", saved: "Saved", error: "Error" } as const;

// Manual save through the same function the autosave uses; also shows the autosave's status.
const SaveButton = () => {
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const saveNow = useCanvasSaveStore((state) => state.saveNow);

  const Icon =
    saveStatus === "saving" ? Loader2 : saveStatus === "saved" ? Check : saveStatus === "error" ? AlertCircle : Save;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!saveNow || saveStatus === "saving"}
      onClick={() => void saveNow?.()}
      className={
        saveStatus === "error"
          ? "h-8 gap-1.5 border-state-error/40 px-3 font-mono text-xs text-state-error"
          : saveStatus === "saved"
            ? "h-8 gap-1.5 border-state-success/40 px-3 font-mono text-xs text-state-success"
            : "h-8 gap-1.5 border-surface-border-subtle px-3 font-mono text-xs text-copy-secondary hover:text-copy-primary"
      }
    >
      <Icon className={saveStatus === "saving" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
      <span>{LABELS[saveStatus]}</span>
    </Button>
  );
};

export default SaveButton;
