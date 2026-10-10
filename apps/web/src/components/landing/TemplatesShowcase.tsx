import {
  CANVAS_TEMPLATES,
  type CanvasTemplate,
} from "@/components/editor/canvas/starter-templates";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const PAD = 14;
const VIEW_W = 300;
const VIEW_H = 170;

const sizeOf = (node: CanvasTemplate["nodes"][number]) => ({
  w: Number(node.style?.width ?? 120),
  h: Number(node.style?.height ?? 50),
});

// A small picture of a template, drawn from the same node and edge data the editor imports.
const TemplateThumb = ({ template }: { template: CanvasTemplate }) => {
  const boxes = template.nodes.map((node) => ({ node, ...sizeOf(node) }));
  const minX = Math.min(...boxes.map((b) => b.node.position.x));
  const minY = Math.min(...boxes.map((b) => b.node.position.y));
  const maxX = Math.max(...boxes.map((b) => b.node.position.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.node.position.y + b.h));
  const scale = Math.min(
    (VIEW_W - PAD * 2) / (maxX - minX),
    (VIEW_H - PAD * 2) / (maxY - minY),
  );
  const offsetX = (VIEW_W - (maxX - minX) * scale) / 2;
  const offsetY = (VIEW_H - (maxY - minY) * scale) / 2;

  const placed = new Map(
    boxes.map(({ node, w, h }) => {
      const x = (node.position.x - minX) * scale + offsetX;
      const y = (node.position.y - minY) * scale + offsetY;
      return [
        node.id,
        {
          node,
          x,
          y,
          w: w * scale,
          h: h * scale,
          cx: x + (w * scale) / 2,
          cy: y + (h * scale) / 2,
        },
      ];
    }),
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-full w-full"
      aria-hidden="true"
    >
      {template.edges.map((edge) => {
        const source = placed.get(edge.source);
        const target = placed.get(edge.target);
        if (!source || !target) return null;
        return (
          <line
            key={edge.id}
            x1={source.cx}
            y1={source.cy}
            x2={target.cx}
            y2={target.cy}
            stroke="var(--canvas-edge)"
            strokeWidth="1.2"
            strokeDasharray="3 3"
            opacity="0.55"
          />
        );
      })}
      {[...placed.values()].map(({ node, x, y, w, h, cx, cy }) => {
        const fill = node.data.color;
        const stroke = node.data.textColor;
        const shape = node.data.shape;
        const radius = shape === "pill" || shape === "circle" ? h / 2 : 5;
        return (
          <g key={node.id}>
            {shape === "diamond" ? (
              <polygon
                points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.1"
              />
            ) : shape === "circle" ? (
              <ellipse
                cx={cx}
                cy={cy}
                rx={w / 2}
                ry={h / 2}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.1"
              />
            ) : (
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth="1.1"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
};

const TemplatesShowcase = () => (
  <section
    id="templates"
    className="scroll-mt-20 border-t border-surface-border py-24"
  >
    <div className="mx-auto max-w-6xl px-5">
      <Reveal>
        <SectionHeading
          eyebrow="Starter templates"
          title="Start from a pattern that already works"
          description="Import a prebuilt architecture into your canvas in one click, at any point while you work. Then let the AI extend it."
        />
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
        {CANVAS_TEMPLATES.map((template, index) => (
          <Reveal key={template.id} delay={index * 100}>
            <article className="group flex h-full flex-col gap-4 rounded-2xl border border-surface-border bg-surface p-4 transition-colors hover:border-surface-border-subtle">
              <div className="aspect-[300/170] overflow-hidden rounded-xl border border-surface-border-subtle bg-base transition-colors group-hover:border-brand/30">
                <TemplateThumb template={template} />
              </div>
              <div className="space-y-1.5 px-1 pb-1">
                <h3 className="font-mono text-sm font-bold text-copy-primary">
                  {template.name}
                </h3>
                <p className="text-xs leading-relaxed text-copy-muted">
                  {template.description}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default TemplatesShowcase;
