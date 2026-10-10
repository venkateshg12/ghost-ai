import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroCanvas from "./HeroCanvas";
import Reveal from "./Reveal";

const FACTS = [
  "Real-time collaboration",
  "AI-drawn architecture",
  "6 node shapes · 8 palettes",
  "Markdown specs",
];

const Hero = () => (
  <section className="relative overflow-hidden">
    {/* Backdrop: a faded grid and two soft glows in the brand and AI accents. */}
    <div
      aria-hidden="true"
      className="landing-grid pointer-events-none absolute inset-0"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[44rem] -translate-x-[85%] animate-glow rounded-full bg-brand/15 blur-3xl"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-32 left-1/2 h-[26rem] w-[40rem] -translate-x-[10%] animate-glow rounded-full bg-ai/20 blur-3xl"
    />

    <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 sm:pt-24">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-surface-border-subtle bg-surface/80 px-3.5 py-1.5 font-mono text-xs text-copy-secondary backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-ai-text" />
            <span>AI-native system design workspace</span>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="mt-7 text-4xl font-extrabold leading-[1.05] tracking-tight text-copy-primary sm:text-6xl">
            Design systems at the{" "}
            <span className="bg-linear-to-r from-brand via-ai-text to-brand bg-clip-text text-transparent">
              speed of thought.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-2xl text-[1rem] leading-relaxed text-copy-muted sm:text-lg">
            Describe your architecture in plain English. Ghost AI draws it on a
            shared canvas, your team refines it live, and one click turns the
            graph into a technical spec.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              className="h-12 w-full gap-2 px-7 text-[1rem] font-semibold sm:w-auto"
            >
              <Link href="/sign-up">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 w-full px-7 text-[1rem] sm:w-auto"
            >
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={320}>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-copy-muted">
            {FACTS.map((fact) => (
              <li key={fact} className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-brand" />
                {fact}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      <Reveal delay={400} className="mt-16">
        <HeroCanvas />
      </Reveal>
    </div>
  </section>
);

export default Hero;
