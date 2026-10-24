"use client";

import { NodeToolbar, Position } from "@xyflow/react";
import { NODE_COLORS, type ColorPair } from "@repo/types";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { themedNodeColors } from "@/lib/nodeTheme";

interface NodeColorToolbarProps {
  visible: boolean;
  activeColor: string;
  onSelect: (pair: ColorPair) => void;
}

/*
  Floats just above a selected node. Each swatch is a fill/text pair, so picking one recolours the
  node and keeps its label readable. `nodrag nopan` keeps clicks here from moving the canvas.
 */
const NodeColorToolbar = ({
  visible,
  activeColor,
  onSelect,
}: NodeColorToolbarProps) => {
  const { resolved: theme } = useTheme();
  return (
    <NodeToolbar
      position={Position.Top}
      offset={12}
      isVisible={visible}
      className="nodrag nopan flex items-center gap-1.5 rounded-xl border border-surface-border bg-elevated/95 p-1.5 shadow-xl backdrop-blur-md"
    >
      {NODE_COLORS.map((pair) => {
        const isActive = activeColor.toLowerCase() === pair.bg.toLowerCase();
        // Swatches show the colours as drawn in this theme; picking one still saves the palette pair.
        const shown = themedNodeColors(pair.bg, pair.text, theme);
        return (
          <button
            key={pair.label}
            type="button"
            title={`${pair.label} theme`}
            aria-label={`${pair.label} theme`}
            aria-pressed={isActive}
            onClick={() => onSelect(pair)}
            className={cn(
              "relative flex h-5 w-5 items-center justify-center rounded-full border transition-[transform,box-shadow] duration-150 hover:scale-125 hover:shadow-[0_0_6px_var(--swatch-glow)] focus:outline-none",
              isActive &&
                "shadow-[0_0_8px_var(--swatch-glow),inset_0_0_0_1px_var(--swatch-glow)]",
            )}
            style={
              {
                backgroundColor: shown.bg,
                borderColor: isActive
                  ? "var(--text-primary)"
                  : `${shown.text}40`,
                "--swatch-glow": shown.text,
              } as React.CSSProperties
            }
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-transform",
                isActive && "scale-125",
              )}
              style={{ backgroundColor: shown.text }}
            />
          </button>
        );
      })}
    </NodeToolbar>
  );
};

export default NodeColorToolbar;
