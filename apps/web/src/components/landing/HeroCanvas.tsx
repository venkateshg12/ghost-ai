import { Bot, MousePointer2, Send, Sparkles } from "lucide-react";
import { NODE_COLORS, type NodeShape } from "@repo/types";
import { ShapeBody } from "@/components/editor/canvas/shapes";
import { cn } from "@/lib/utils";

/*
  A picture of the product, drawn with the product's own pieces: the real node shapes and colour
  palette, the same edge and cursor styling, and the AI sidebar. Everything is positioned in a
  1000 x 625 design space and expressed as percentages, so the whole scene scales with its frame;
  type sizes use container-query units for the same reason.
 */
const W = 1000;
const H = 625;

const color = (label: string) =>
  NODE_COLORS.find((pair) => pair.label === label) ?? NODE_COLORS[0]!;

interface SceneNode {
  id: string;
  label: string;
  shape: NodeShape;
  tone: string;
  x: number;
  y: number;
  w: number;
  h: number;
  selected?: boolean;
}

const NODES: SceneNode[] = [
  {
    id: "client",
    label: "Web Client",
    shape: "pill",
    tone: "Blue",
    x: 30,
    y: 285,
    w: 130,
    h: 54,
  },
  {
    id: "gateway",
    label: "API Gateway",
    shape: "hexagon",
    tone: "Teal",
    x: 215,
    y: 262,
    w: 150,
    h: 100,
  },
  {
    id: "urls",
    label: "URL Service",
    shape: "rectangle",
    tone: "Purple",
    x: 390,
    y: 120,
    w: 140,
    h: 60,
    selected: true,
  },
  {
    id: "queue",
    label: "Analytics Queue",
    shape: "pill",
    tone: "Orange",
    x: 390,
    y: 440,
    w: 140,
    h: 54,
  },
  {
    id: "cache",
    label: "Redis Cache",
    shape: "cylinder",
    tone: "Red",
    x: 585,
    y: 60,
    w: 100,
    h: 110,
  },
  {
    id: "db",
    label: "PostgreSQL",
    shape: "cylinder",
    tone: "Green",
    x: 585,
    y: 275,
    w: 100,
    h: 120,
  },
];

// Right-angle path with rounded corners, like the editor's smooth-step edges.
const stepPath = (x1: number, y1: number, x2: number, y2: number, r = 14) => {
  if (y1 === y2) return `M${x1} ${y1}H${x2}`;
  const mx = (x1 + x2) / 2;
  const dir = y2 > y1 ? 1 : -1;
  return `M${x1} ${y1}H${mx - r}Q${mx} ${y1} ${mx} ${y1 + dir * r}V${y2 - dir * r}Q${mx} ${y2} ${mx + r} ${y2}H${x2}`;
};

interface SceneEdge {
  id: string;
  label: string;
  from: [number, number];
  to: [number, number];
}

const EDGES: SceneEdge[] = [
  { id: "e1", label: "HTTPS", from: [160, 312], to: [215, 312] },
  { id: "e2", label: "REST", from: [365, 312], to: [390, 150] },
  { id: "e3", label: "publish", from: [365, 312], to: [390, 467] },
  { id: "e4", label: "cache", from: [530, 150], to: [585, 115] },
  { id: "e5", label: "SQL", from: [530, 150], to: [585, 335] },
  { id: "e6", label: "batch", from: [530, 467], to: [585, 335] },
];

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

// Where an edge's label sits: on the vertical run of a step edge, just above a straight one.
const labelPoint = ({ from, to }: SceneEdge): [number, number] =>
  from[1] === to[1]
    ? [(from[0] + to[0]) / 2, from[1] - 20]
    : [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];

const CursorTag = ({
  name,
  className,
  tone,
}: {
  name: string;
  className?: string;
  tone: "brand" | "ai";
}) => (
  <div className={cn("pointer-events-none absolute", className)}>
    <MousePointer2
      className={cn(
        "h-[1.6cqw] min-h-3 w-[1.6cqw] min-w-3",
        tone === "ai" ? "text-ai-text" : "text-brand",
      )}
    />
    <span
      className={cn(
        "ml-[1.2cqw] -mt-[0.2cqw] inline-block whitespace-nowrap rounded-full px-[0.9cqw] py-[0.25cqw] font-mono text-[max(7px,1.05cqw)] font-semibold",
        tone === "ai" ? "bg-ai text-white" : "bg-brand text-primary-foreground",
      )}
    >
      {name}
    </span>
  </div>
);

const ChatPanel = () => (
  <aside
    aria-hidden="true"
    className="absolute bottom-[2.2cqw] right-[2.2cqw] top-[2.2cqw] hidden w-[27%] flex-col overflow-hidden rounded-2xl border border-surface-border bg-base/95 shadow-2xl backdrop-blur-md md:flex"
  >
    <div className="flex items-center gap-[0.9cqw] border-b border-surface-border bg-elevated/40 px-[1.2cqw] py-[1cqw]">
      <div className="flex h-[2.4cqw] w-[2.4cqw] items-center justify-center rounded-xl bg-ai text-white">
        <Sparkles className="h-[1.4cqw] w-[1.4cqw]" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[max(8px,1.15cqw)] font-bold leading-none text-copy-primary">
          AI Workspace
        </p>
        <p className="mt-[0.3cqw] font-mono text-[max(7px,0.95cqw)] text-copy-muted">
          Collaborate with Ghost AI
        </p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-[0.4cqw] border-b border-surface-border-subtle px-[1.2cqw] py-[0.9cqw]">
      <span className="rounded-xl bg-ai py-[0.5cqw] text-center font-mono text-[max(7px,1cqw)] font-semibold text-white">
        AI Architect
      </span>
      <span className="py-[0.5cqw] text-center font-mono text-[max(7px,1cqw)] font-semibold text-copy-muted">
        Specs
      </span>
    </div>

    <div className="flex flex-1 flex-col justify-end gap-[1cqw] overflow-hidden px-[1.2cqw] py-[1cqw]">
      <div className="flex items-start gap-[0.7cqw]">
        <div className="mt-[0.2cqw] flex h-[2cqw] w-[2cqw] shrink-0 items-center justify-center rounded-full border border-ai/30 bg-ai/15 text-ai-text">
          <Bot className="h-[1.1cqw] w-[1.1cqw]" />
        </div>
        <div className="rounded-2xl rounded-tl-none border border-surface-border-subtle bg-elevated px-[1cqw] py-[0.8cqw] text-[max(7.5px,1.05cqw)] leading-snug text-copy-secondary">
          Describe a system and I will draw it on the canvas.
        </div>
      </div>
      <div className="ml-auto max-w-[88%] rounded-2xl rounded-tr-none border border-state-success/50 bg-state-success/15 px-[1cqw] py-[0.8cqw] text-[max(7.5px,1.05cqw)] leading-snug text-copy-primary">
        Design a URL shortener with an API, a cache and a database.
      </div>
      <div className="flex items-start gap-[0.7cqw]">
        <div className="mt-[0.2cqw] flex h-[2cqw] w-[2cqw] shrink-0 items-center justify-center rounded-full border border-ai/30 bg-ai/15 text-ai-text">
          <Bot className="h-[1.1cqw] w-[1.1cqw]" />
        </div>
        <div className="rounded-2xl rounded-tl-none border border-surface-border-subtle bg-elevated px-[1cqw] py-[0.8cqw] text-[max(7.5px,1.05cqw)] leading-snug text-copy-secondary">
          Done. I mapped 6 components: gateway, URL service, cache, queue and a
          Postgres store.
        </div>
      </div>
    </div>

    <div className="space-y-[0.8cqw] border-t border-surface-border bg-elevated/20 px-[1.2cqw] py-[1cqw]">
      <div className="flex items-center gap-[0.6cqw] rounded-xl border border-state-success/30 bg-base px-[0.9cqw] py-[0.6cqw] font-mono text-[max(7px,0.95cqw)] text-state-success">
        <span className="h-[0.7cqw] min-h-1 w-[0.7cqw] min-w-1 animate-pulse rounded-full bg-state-success" />
        Drawing 8 changes on the canvas…
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-surface-border-subtle bg-base px-[1cqw] py-[0.7cqw]">
        <span className="font-mono text-[max(7px,0.95cqw)] text-copy-muted">
          Ask Ghost AI…
        </span>
        <span className="flex h-[2.2cqw] w-[3.6cqw] items-center justify-center rounded-xl bg-state-success text-primary-foreground">
          <Send className="h-[1.1cqw] w-[1.1cqw]" />
        </span>
      </div>
    </div>
  </aside>
);

const HeroCanvas = () => (
  <div className="relative">
    {/* Glow behind the frame. */}
    <div
      aria-hidden="true"
      className="absolute -inset-x-6 -inset-y-8 -z-10 animate-glow rounded-3xl bg-linear-to-r from-brand/20 via-ai/25 to-brand/10 blur-3xl"
    />

    <div className="overflow-hidden rounded-3xl border border-surface-border-subtle bg-surface shadow-2xl">
      {/* Window chrome, echoing the editor navbar. */}
      <div className="flex h-9 items-center justify-between gap-3 border-b border-surface-border bg-surface px-4 sm:h-11">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-surface-border-subtle" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-border-subtle" />
          <span className="h-2.5 w-2.5 rounded-full bg-surface-border-subtle" />
        </div>
        <span className="truncate rounded-xl border border-surface-border-subtle bg-base px-3 py-0.5 font-mono text-[11px] font-semibold text-copy-primary">
          URL Shortener
        </span>
        <span className="hidden items-center gap-1.5 font-mono text-[11px] text-state-success sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-state-success" />
          Saved
        </span>
        <span className="w-9 sm:hidden" aria-hidden="true" />
      </div>

      <div
        role="img"
        aria-label="Ghost AI canvas: an AI-generated URL shortener architecture with a web client, API gateway, URL service, cache, queue and database"
        className="relative aspect-[7/6.25] w-full overflow-hidden bg-base md:aspect-[8/5]"
      >
        {/* Below md the chat panel is hidden, so the scene is cropped to its left 70% and the nodes
            render larger; from md up it fills the frame. Container-query units follow this element. */}
        <div className="@container absolute left-0 top-0 aspect-[8/5] w-[143%] md:w-full">
          {/* Dotted canvas background, as in React Flow. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "radial-gradient(var(--canvas-dot) 1.2px, transparent 1.2px)",
              backgroundSize: "20px 20px",
            }}
          />

          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <marker
                id="hero-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--canvas-edge)" />
              </marker>
            </defs>
            {EDGES.map((edge) => (
              <path
                key={edge.id}
                d={stepPath(edge.from[0], edge.from[1], edge.to[0], edge.to[1])}
                fill="none"
                stroke="var(--canvas-edge)"
                strokeWidth="1.6"
                strokeLinecap="round"
                opacity="0.75"
                markerEnd="url(#hero-arrow)"
                className="edge-flow"
              />
            ))}
          </svg>

          {/* Edge labels. */}
          {EDGES.map((edge) => {
            const [lx, ly] = labelPoint(edge);
            return (
              <span
                key={edge.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface-border-subtle bg-elevated/90 px-[0.8cqw] py-[0.15cqw] font-mono text-[max(6.5px,1cqw)] text-copy-secondary"
                style={{ left: pct(lx, W), top: pct(ly, H) }}
              >
                {edge.label}
              </span>
            );
          })}

          {/* Nodes: the same shape renderer the editor uses. */}
          {NODES.map((node) => {
            const pair = color(node.tone);
            return (
              <div
                key={node.id}
                className="absolute"
                style={{
                  left: pct(node.x, W),
                  top: pct(node.y, H),
                  width: pct(node.w, W),
                  height: pct(node.h, H),
                }}
              >
                <ShapeBody
                  shape={node.shape}
                  fill={pair.bg}
                  stroke={
                    node.selected ? "var(--accent-primary)" : `${pair.text}55`
                  }
                  strokeWidth={node.selected ? 2 : 1.5}
                  selected={node.selected}
                />
                <span
                  className="pointer-events-none absolute inset-0 flex items-center justify-center px-[1.2cqw] text-center font-mono text-[max(6.5px,1.2cqw)] font-semibold leading-tight"
                  style={{ color: pair.text }}
                >
                  {node.label}
                </span>
              </div>
            );
          })}

          <CursorTag
            name="Maya"
            tone="brand"
            className="left-[42%] top-[30.5%] animate-float"
          />
          <CursorTag
            name="Ghost AI"
            tone="ai"
            className="left-[57%] top-[72%] animate-float-delayed"
          />

          <ChatPanel />
        </div>
      </div>
    </div>
  </div>
);

export default HeroCanvas;
