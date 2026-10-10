"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  useCanRedo,
  useCanUndo,
  useRedo,
  useUndo,
} from "@liveblocks/react/suspense";
import {
  Braces,
  Check,
  Copy,
  Download,
  FileCode,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Redo2,
  Undo2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDiagramTools } from "@/hooks/editor/useDiagramTools";
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
      disabled
        ? "cursor-not-allowed opacity-35"
        : "hover:bg-subtle hover:text-copy-primary",
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

  const handleZoomIn = useCallback(
    () => void zoomIn({ duration: ZOOM_DURATION_MS }),
    [zoomIn],
  );
  const { status, tidy, copyMermaid, exportMermaid, exportJson, exportPng } =
    useDiagramTools();
  const handleZoomOut = useCallback(
    () => void zoomOut({ duration: ZOOM_DURATION_MS }),
    [zoomOut],
  );
  const handleFitView = useCallback(
    () => void fitView({ duration: ZOOM_DURATION_MS, padding: 0.2 }),
    [fitView],
  );

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
        <ControlButton
          title="Redo (Ctrl+Shift+Z)"
          onClick={redo}
          disabled={!canRedo}
        >
          <Redo2 className="h-4 w-4" />
        </ControlButton>
        <div className="mx-1 h-4 w-px bg-surface-border-subtle" />
        <ControlButton
          title="Tidy up: arrange the diagram neatly"
          onClick={() => void tidy()}
        >
          <WandSparkles className="h-4 w-4" />
        </ControlButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Export"
              aria-label="Export"
              className="flex h-8 w-8 items-center justify-center rounded-full text-copy-secondary transition-all hover:bg-subtle hover:text-copy-primary active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              {status.kind === "working" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status.kind === "done" ? (
                <Check className="h-4 w-4 text-state-success" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-56 rounded-2xl border-surface-border-subtle bg-elevated p-1.5"
          >
            <DropdownMenuLabel className="px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-copy-muted">
              Export diagram
            </DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => void copyMermaid()}
              className="gap-2 rounded-xl font-mono text-xs"
            >
              <Copy className="h-3.5 w-3.5" /> Copy as Mermaid
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={exportMermaid}
              className="gap-2 rounded-xl font-mono text-xs"
            >
              <FileCode className="h-3.5 w-3.5" /> Download Mermaid (.mmd)
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void exportPng()}
              className="gap-2 rounded-xl font-mono text-xs"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Download PNG
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={exportJson}
              className="gap-2 rounded-xl font-mono text-xs"
            >
              <Braces className="h-3.5 w-3.5" /> Download JSON
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {status.kind === "done" && (
          <span className="pr-2 font-mono text-[11px] text-state-success">
            {status.what}
          </span>
        )}
        {status.kind === "error" && (
          <span className="pr-2 font-mono text-[11px] text-state-error">
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
};

export default CanvasControlBar;
