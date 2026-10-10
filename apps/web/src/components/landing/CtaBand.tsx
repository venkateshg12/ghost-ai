import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Reveal from "./Reveal";

const CtaBand = () => (
  <section className="border-t border-surface-border py-24">
    <div className="mx-auto max-w-6xl px-5">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-surface-border-subtle bg-elevated px-6 py-16 text-center sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 animate-glow rounded-full bg-brand/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 animate-glow rounded-full bg-ai/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="landing-grid pointer-events-none absolute inset-0 opacity-20"
          />

          <div className="relative mx-auto max-w-2xl space-y-6">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-copy-primary sm:text-4xl">
              Your next architecture review starts on a blank canvas.
            </h2>
            <p className="text-[1rem] leading-relaxed text-copy-muted">
              Create an account, describe your system, and invite your team in.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              <Button
                asChild
                className="h-12 w-full gap-2 px-7 text-[1rem] font-semibold sm:w-auto"
              >
                <Link href="/sign-up">
                  Create your account
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 w-full px-7 text-[1rem] sm:w-auto"
              >
                <Link href="/sign-in">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);

export default CtaBand;
