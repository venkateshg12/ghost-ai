import { Check, Download, Eye, FileText } from "lucide-react";
import { NODE_COLORS } from "@repo/types";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const POINTS = [
  "Built from the graph that is actually on the canvas, not from guesses",
  "Includes the conversation, so decisions made in chat are captured",
  "Saved to your project. Preview it in the app or download the Markdown",
];

const tone = (label: string) =>
  NODE_COLORS.find((pair) => pair.label === label) ?? NODE_COLORS[0]!;

const COMPONENTS = [
  {
    name: "API Gateway",
    detail: "Routes and rate-limits client traffic",
    tone: "Teal",
  },
  {
    name: "URL Service",
    detail: "Creates and resolves short links",
    tone: "Purple",
  },
  { name: "Redis Cache", detail: "Serves hot lookups", tone: "Red" },
  { name: "PostgreSQL", detail: "Source of truth for links", tone: "Green" },
];

const SpecDocument = () => (
  <div className="overflow-hidden rounded-3xl border border-surface-border-subtle bg-surface shadow-2xl">
    <div className="flex items-center justify-between gap-3 border-b border-surface-border bg-elevated/40 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-4 w-4 shrink-0 text-ai-text" />
        <span className="truncate font-mono text-xs text-copy-secondary">
          url-shortener-spec.md
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
        <span className="flex items-center gap-1.5 rounded-xl border border-surface-border-subtle px-2.5 py-1 font-mono text-[11px] text-copy-secondary">
          <Eye className="h-3.5 w-3.5" /> Preview
        </span>
        <span className="flex items-center gap-1.5 rounded-xl bg-ai px-2.5 py-1 font-mono text-[11px] font-semibold text-white">
          <Download className="h-3.5 w-3.5" /> Download
        </span>
      </div>
    </div>

    <div className="space-y-5 p-6 text-sm">
      <div className="space-y-2">
        <h3 className="text-xl font-extrabold tracking-tight text-copy-primary">
          Technical Specification: URL Shortener
        </h3>
        <p className="leading-relaxed text-copy-muted">
          A read-heavy service that creates short links and redirects them with
          low latency. Lookups hit the cache first and fall back to Postgres.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="border-b border-surface-border pb-1 text-[1rem] font-semibold text-copy-primary">
          2. Components
        </h4>
        <ul className="space-y-2">
          {COMPONENTS.map((component) => {
            const pair = tone(component.tone);
            return (
              <li key={component.name} className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: pair.text }}
                />
                <p className="leading-relaxed text-copy-muted">
                  <span className="font-semibold text-copy-primary">
                    {component.name}
                  </span>{" "}
                  — {component.detail}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-2">
        <h4 className="border-b border-surface-border pb-1 text-[1rem] font-semibold text-copy-primary">
          3. API
        </h4>
        <pre className="overflow-x-auto rounded-xl border border-surface-border-subtle bg-base p-3 font-mono text-xs leading-relaxed text-copy-secondary">
          <span className="text-brand">POST</span> /api/v1/links{"\n"}
          <span className="text-copy-faint">{"{ "}</span>
          <span className="text-ai-text">&quot;url&quot;</span>
          <span className="text-copy-faint">: </span>
          <span className="text-state-success">
            &quot;https://example.com/long/path&quot;
          </span>
          <span className="text-copy-faint">{" }"}</span>
        </pre>
      </div>
    </div>
  </div>
);

const SpecShowcase = () => (
  <section
    id="specs"
    className="scroll-mt-20 border-t border-surface-border bg-surface/40 py-24"
  >
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 lg:grid-cols-2">
      <Reveal>
        <div className="space-y-8">
          <SectionHeading
            align="left"
            eyebrow="Technical specs"
            title="The diagram becomes the document"
            description="When the design settles, generate a technical specification straight from the canvas. No retyping what is already drawn."
          />
          <ul className="space-y-4">
            {POINTS.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-sm leading-relaxed text-copy-secondary"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-dim text-brand">
                  <Check className="h-3 w-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal delay={120} className="min-w-0">
        <SpecDocument />
      </Reveal>
    </div>
  </section>
);

export default SpecShowcase;
