import type { ReactNode } from "react";
import {
  Circle,
  Cpu,
  Diamond,
  FileText,
  Hexagon,
  LayoutTemplate,
  Lock,
  Shapes,
  Sparkles,
  Square,
  Users,
  Database,
} from "lucide-react";
import { NODE_COLORS } from "@repo/types";
import { cn } from "@/lib/utils";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const tone = (label: string) =>
  NODE_COLORS.find((pair) => pair.label === label) ?? NODE_COLORS[0]!;

const Chip = ({ label, name }: { label: string; name: string }) => {
  const pair = tone(name);
  return (
    <span
      className="rounded-xl border px-2.5 py-1 font-mono text-[11px] font-semibold"
      style={{
        backgroundColor: pair.bg,
        color: pair.text,
        borderColor: `${pair.text}55`,
      }}
    >
      {label}
    </span>
  );
};

/* ---------- Card visuals ---------- */

const PromptVisual = () => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 rounded-2xl border border-surface-border-subtle bg-base px-4 py-3 font-mono text-xs text-copy-secondary">
      <Sparkles className="h-4 w-4 shrink-0 text-ai-text" />
      <span className="truncate">
        Design an e-commerce backend with payments and search
      </span>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Chip label="Storefront" name="Blue" />
      <Chip label="API Gateway" name="Teal" />
      <Chip label="Order Service" name="Purple" />
      <Chip label="Payments" name="Orange" />
      <Chip label="Orders DB" name="Green" />
      <Chip label="Search Index" name="Pink" />
    </div>
  </div>
);

const CollabVisual = () => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex -space-x-2" aria-hidden="true">
      {["Blue", "Purple", "Orange", "Green"].map((name, index) => {
        const pair = tone(name);
        return (
          <span
            key={name}
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface font-mono text-xs font-bold"
            style={{ backgroundColor: pair.bg, color: pair.text }}
          >
            {["M", "R", "J", "A"][index]}
          </span>
        );
      })}
    </div>
    <span className="flex items-center gap-2 rounded-full border border-state-success/30 bg-state-success/10 px-3 py-1 font-mono text-[11px] text-state-success">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-state-success" />
      4 online
    </span>
  </div>
);

const SpecVisual = () => (
  <div className="space-y-2 rounded-2xl border border-surface-border-subtle bg-base p-4 font-mono text-[11px] leading-relaxed">
    <p className="font-bold text-copy-primary"># Technical Specification</p>
    <p className="text-brand">## 2. Components</p>
    <p className="text-copy-muted">
      - URL Service — creates and resolves short links
    </p>
    <p className="text-copy-muted">- Redis Cache — hot-path lookups</p>
  </div>
);

const TemplatesVisual = () => (
  <ul className="space-y-2 font-mono text-xs">
    {[
      "Microservices Architecture",
      "CI/CD Pipeline",
      "Event-Driven System",
    ].map((name) => (
      <li
        key={name}
        className="flex items-center justify-between rounded-xl border border-surface-border-subtle bg-base px-3 py-2 text-copy-secondary"
      >
        {name}
        <span className="text-brand">Import</span>
      </li>
    ))}
  </ul>
);

const ShapesVisual = () => {
  const items = [
    { Icon: Square, name: "Blue" },
    { Icon: Diamond, name: "Purple" },
    { Icon: Circle, name: "Orange" },
    { Icon: Database, name: "Green" },
    { Icon: Hexagon, name: "Teal" },
  ];
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {items.map(({ Icon, name }) => {
        const pair = tone(name);
        return (
          <span
            key={name}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: pair.bg,
              color: pair.text,
              borderColor: `${pair.text}55`,
            }}
          >
            <Icon className="h-5 w-5" />
          </span>
        );
      })}
    </div>
  );
};

const SecureVisual = () => (
  <ul className="space-y-2 text-xs text-copy-muted">
    {[
      "Owner and collaborator roles",
      "Access checked on every request",
      "Private storage for canvases and specs",
    ].map((line) => (
      <li key={line} className="flex items-start gap-2">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
        {line}
      </li>
    ))}
  </ul>
);

/* ---------- Grid ---------- */

interface FeatureCard {
  icon: typeof Cpu;
  title: string;
  text: string;
  visual: ReactNode;
  className?: string;
}

const CARDS: FeatureCard[] = [
  {
    icon: Cpu,
    title: "AI architecture generation",
    text: "Say what you are building. Ghost AI turns the prompt into nodes and edges on the canvas, and keeps going when you ask for changes.",
    visual: <PromptVisual />,
    className: "lg:col-span-2",
  },
  {
    icon: Users,
    title: "Real-time collaboration",
    text: "Live cursors, presence and shared editing. Everyone sees the AI draw, as it draws.",
    visual: <CollabVisual />,
  },
  {
    icon: FileText,
    title: "Instant technical specs",
    text: "Turn the canvas into a Markdown spec grounded in what is actually on it. Preview it, download it.",
    visual: <SpecVisual />,
  },
  {
    icon: LayoutTemplate,
    title: "Starter templates",
    text: "Import a proven pattern into the canvas at any point, then make it yours.",
    visual: <TemplatesVisual />,
  },
  {
    icon: Shapes,
    title: "Shapes and colour that mean something",
    text: "Six node shapes and eight palettes keep clients, services and data stores readable at a glance.",
    visual: <ShapesVisual />,
  },
  {
    icon: Lock,
    title: "Private by design",
    text: "Projects belong to their owner and the people they invite. Nobody else gets in.",
    visual: <SecureVisual />,
    className: "lg:col-span-3",
  },
];

const Features = () => (
  <section
    id="features"
    className="scroll-mt-20 border-t border-surface-border py-24"
  >
    <div className="mx-auto max-w-6xl px-5">
      <Reveal>
        <SectionHeading
          eyebrow="Features"
          title="Everything between idea and spec"
          description="One workspace for sketching, reviewing and documenting a system, with an AI collaborator in the room."
        />
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(({ icon: Icon, title, text, visual, className }, index) => (
          <Reveal
            key={title}
            delay={(index % 3) * 80}
            className={cn("h-full min-w-0", className)}
          >
            <article className="group flex h-full flex-col gap-6 rounded-2xl border border-surface-border bg-surface p-6 transition-colors hover:border-surface-border-subtle hover:bg-elevated/60">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-border-subtle bg-elevated text-brand transition-colors group-hover:border-brand/40 group-hover:bg-accent-dim">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-[1rem] font-semibold text-copy-primary">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-copy-muted">
                  {text}
                </p>
              </div>
              <div className="mt-auto">{visual}</div>
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default Features;
