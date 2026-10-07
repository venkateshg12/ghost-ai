"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useCanRedo, useCanUndo, useRedo, useUndo } from "@liveblocks/react/suspense";
import { Maximize2, Redo2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/editor/useKeyboardShortcuts";
import { cn } from "@/lib/utils";

const ZOOM_DURATION_MS = 300;

const ControlButton = ({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-8 w-8 items-center justify-center rounded-full text-copy-secondary transition-all active:scale-95",
      disabled ? "cursor-not-allowed opacity-35" : "hover:bg-subtle hover:text-copy-primary"
    )}
  >
    {children}
  </button>
);

// Bottom-left pill: zoom (via React Flow) and undo/redo (via Liveblocks history), plus the same
// actions on the keyboard.
const CanvasControlBar = () => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const undo = useUndo();
  const redo = useRedo();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const handleZoomIn = useCallback(() => void zoomIn({ duration: ZOOM_DURATION_MS }), [zoomIn]);
  const handleZoomOut = useCallback(() => void zoomOut({ duration: ZOOM_DURATION_MS }), [zoomOut]);
  const handleFitView = useCallback(() => void fitView({ duration: ZOOM_DURATION_MS, padding: 0.2 }), [fitView]);

  useKeyboardShortcuts({
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onUndo: undo,
    onRedo: redo,
    canUndo,
    canRedo,
  });

  return (
    <div className="pointer-events-auto absolute bottom-6 left-6 z-30 select-none">
      <div className="flex items-center gap-1 rounded-full border border-surface-border-subtle bg-surface/85 p-1.5 shadow-2xl backdrop-blur-xl">
        <ControlButton title="Zoom out (-)" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </ControlButton>
        <ControlButton title="Fit view" onClick={handleFitView}>
          <Maximize2 className="h-4 w-4" />
        </ControlButton>
        <ControlButton title="Zoom in (+)" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </ControlButton>
        <div className="mx-1 h-4 w-px bg-surface-border-subtle" />
        <ControlButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <Undo2 className="h-4 w-4" />
        </ControlButton>
        <ControlButton title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
          <Redo2 className="h-4 w-4" />
        </ControlButton>
      </div>
    </div>
  );
};

export default CanvasControlBar;
