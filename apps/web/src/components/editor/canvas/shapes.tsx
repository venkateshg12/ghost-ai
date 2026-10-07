import type { ReactNode } from "react";
import { Circle, Database, Diamond, Hexagon, Square } from "lucide-react";
import type { NodeShape } from "@repo/types";
import { cn } from "@/lib/utils";

export interface ShapePreset {
  type: NodeShape;
  label: string;
  width: number;
  height: number;
  icon: ReactNode;
}

// What the shape panel offers, with sensible default sizes: wide rectangles, square circles,
// diamonds a little larger so a label fits inside the points.
export const SHAPE_PRESETS: ShapePreset[] = [
  { type: "rectangle", label: "Rectangle", width: 140, height: 64, icon: <Square className="h-4 w-4" /> },
  { type: "diamond", label: "Diamond", width: 120, height: 110, icon: <Diamond className="h-4 w-4" /> },
  { type: "circle", label: "Circle", width: 90, height: 90, icon: <Circle className="h-4 w-4" /> },
  { type: "pill", label: "Pill", width: 140, height: 54, icon: <span className="h-3 w-5 rounded-full border border-current" /> },
  { type: "cylinder", label: "Cylinder", width: 96, height: 110, icon: <Database className="h-4 w-4" /> },
  { type: "hexagon", label: "Hexagon", width: 130, height: 96, icon: <Hexagon className="h-4 w-4" /> },
];

export const SVG_SHAPES: NodeShape[] = ["diamond", "hexagon", "cylinder"];

interface ShapeBodyProps {
  shape: NodeShape;
  fill: string;
  stroke: string;
  strokeWidth: number;
  dashed?: boolean;
  selected?: boolean;
  children?: ReactNode;
}

/*
  The visual body of a node. Rectangle, pill and circle are CSS boxes; diamond, hexagon and cylinder
  are SVGs stretched to the node's box (preserveAspectRatio="none"), so every shape resizes cleanly.
  The label (children) is centred on top in both cases.
 */
export const ShapeBody = ({ shape, fill, stroke, strokeWidth, dashed, selected, children }: ShapeBodyProps) => {
  const dash = dashed ? "4 4" : undefined;

  if (SVG_SHAPES.includes(shape)) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {shape === "diamond" && (
            <polygon points="50,2 98,50 50,98 2,50" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
          )}
          {shape === "hexagon" && (
            <polygon points="25,2 75,2 98,50 75,98 25,98 2,50" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
          )}
          {shape === "cylinder" && (
            <>
              <path d="M 3 15 A 47 11 0 0 0 97 15 V 85 A 47 11 0 0 1 3 85 Z" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
              <ellipse cx="50" cy="15" rx="47" ry="11" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        <div className={cn("relative z-10 flex h-full w-full items-center justify-center", shape === "cylinder" ? "px-2 pt-4" : "px-6")}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center transition-shadow",
        shape === "circle" || shape === "pill" ? "rounded-full" : "rounded-xl",
        shape === "pill" ? "px-6" : "px-3",
        selected && "shadow-[0_0_0_4px_var(--accent-primary-dim)]"
      )}
      style={{
        backgroundColor: fill,
        borderColor: stroke,
        borderWidth: strokeWidth,
        borderStyle: dashed ? "dashed" : "solid",
      }}
    >
      {children}
    </div>
  );
};
