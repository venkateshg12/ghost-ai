import { FileText, MessageSquare, Sparkles, Users } from "lucide-react";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const STEPS = [
  {
    icon: MessageSquare,
    title: "Describe it",
    text: "Tell the AI what you are building in plain English, or import a starter template.",
  },
  {
    icon: Sparkles,
    title: "Watch it draw",
    text: "Nodes and edges appear on the shared canvas while a live AI cursor moves through them.",
  },
  {
    icon: Users,
    title: "Refine together",
    text: "Invite collaborators by email. Drag, rename, recolour, reconnect and ask for more.",
  },
  {
    icon: FileText,
    title: "Generate the spec",
    text: "Ghost AI writes a Markdown technical spec from the final graph. Preview and download it.",
  },
];

const HowItWorks = () => (
  <section
    id="how-it-works"
    className="scroll-mt-20 border-t border-surface-border bg-surface/40 py-24"
  >
    <div className="mx-auto max-w-6xl px-5">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="From a sentence to a spec in four steps"
        />
      </Reveal>

      <ol className="relative mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {/* Connector behind the step badges, large screens only. */}
        <div
          aria-hidden="true"
          className="absolute left-[12%] right-[12%] top-5 hidden h-px bg-linear-to-r from-transparent via-surface-border-subtle to-transparent lg:block"
        />

        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <Reveal key={title} delay={index * 100}>
            <li className="relative flex flex-col items-center text-center">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-brand/40 bg-base font-mono text-sm font-bold text-brand">
                {index + 1}
              </span>
              <div className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-surface-border-subtle bg-elevated text-ai-text">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-[1rem] font-semibold text-copy-primary">
                {title}
              </h3>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-copy-muted">
                {text}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>
    </div>
  </section>
);

export default HowItWorks;
