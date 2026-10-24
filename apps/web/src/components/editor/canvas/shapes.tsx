import type { ReactNode } from "react";
import { Circle, Cloud, Database, Diamond, FileText, Hexagon, Square, Star, Triangle, Type } from "lucide-react";
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
  { type: "triangle", label: "Triangle", width: 120, height: 104, icon: <Triangle className="h-4 w-4" /> },
  { type: "parallelogram", label: "Parallelogram", width: 150, height: 64, icon: <span className="h-3 w-5 -skew-x-[20deg] border border-current" /> },
  { type: "cloud", label: "Cloud", width: 150, height: 100, icon: <Cloud className="h-4 w-4" /> },
  { type: "document", label: "Document", width: 130, height: 90, icon: <FileText className="h-4 w-4" /> },
  { type: "star", label: "Star", width: 120, height: 115, icon: <Star className="h-4 w-4" /> },
  { type: "text", label: "Text", width: 120, height: 40, icon: <Type className="h-4 w-4" /> },
];

interface SvgShape {
  /** The outline, in a 100x100 box that is stretched to the node. */
  draw: (paint: SvgPaint) => ReactNode;
  /** Padding for the label, so it sits inside the outline rather than across its slanted edges. */
  labelClass: string;
}

type SvgPaint = Pick<ShapeBodyProps, "fill" | "stroke" | "strokeWidth"> & { dash?: string };

const common = ({ fill, stroke, strokeWidth, dash }: SvgPaint) => ({
  fill,
  stroke,
  strokeWidth,
  strokeDasharray: dash,
  strokeLinejoin: "round" as const,
  vectorEffect: "non-scaling-stroke" as const,
});

const SVG_BODIES: Partial<Record<NodeShape, SvgShape>> = {
  diamond: {
    draw: (paint) => <polygon points="50,2 98,50 50,98 2,50" {...common(paint)} />,
    labelClass: "px-6",
  },
  hexagon: {
    draw: (paint) => <polygon points="25,2 75,2 98,50 75,98 25,98 2,50" {...common(paint)} />,
    labelClass: "px-6",
  },
  cylinder: {
    draw: (paint) => (
      <>
        <path d="M 3 15 A 47 11 0 0 0 97 15 V 85 A 47 11 0 0 1 3 85 Z" {...common(paint)} />
        <ellipse cx="50" cy="15" rx="47" ry="11" {...common(paint)} />
      </>
    ),
    labelClass: "px-2 pt-4",
  },
  triangle: {
    draw: (paint) => <polygon points="50,3 97,97 3,97" {...common(paint)} />,
    labelClass: "px-8 pt-7",
  },
  parallelogram: {
    draw: (paint) => <polygon points="20,3 98,3 80,97 2,97" {...common(paint)} />,
    labelClass: "px-8",
  },
  cloud: {
    draw: (paint) => (
      <path d="M 25 80 A 18 18 0 0 1 22 45 A 22 22 0 0 1 50 22 A 20 20 0 0 1 82 35 A 18 18 0 0 1 80 80 Z" {...common(paint)} />
    ),
    labelClass: "px-8 pt-2",
  },
  document: {
    draw: (paint) => <path d="M 3 4 H 97 V 86 C 80 76, 65 76, 50 86 C 35 96, 20 96, 3 86 Z" {...common(paint)} />,
    labelClass: "px-4 pb-4",
  },
  star: {
    draw: (paint) => <polygon points="50,3 61,37 97,37 68,59 79,95 50,73 21,95 32,59 3,37 39,37" {...common(paint)} />,
    labelClass: "px-9 pt-2",
  },
};

export const SVG_SHAPES = Object.keys(SVG_BODIES) as NodeShape[];

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
  The visual body of a node. Rectangle, pill and circle are CSS boxes; text is a CSS box with no fill and
  no border until it is selected; everything else is an SVG stretched to the node's box
  (preserveAspectRatio="none"), so every shape resizes cleanly. The label (children) is centred on top.
 */
export const ShapeBody = ({ shape, fill, stroke, strokeWidth, dashed, selected, children }: ShapeBodyProps) => {
  const dash = dashed ? "4 4" : undefined;
  const svg = SVG_BODIES[shape];

  if (svg) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {svg.draw({ fill, stroke, strokeWidth, dash })}
        </svg>
        <div className={cn("relative z-10 flex h-full w-full items-center justify-center", svg.labelClass)}>{children}</div>
      </div>
    );
  }

  if (shape === "text") {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-lg px-1"
        style={{
          borderColor: selected || dashed ? stroke : "transparent",
          borderWidth: 1,
          borderStyle: "dashed",
        }}
      >
        {children}
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
