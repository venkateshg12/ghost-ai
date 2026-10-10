import type { ReactNode } from "react";
import Link from "next/link";
import { Cpu, FileText, Users } from "lucide-react";
import BrandMark from "@/components/common/BrandMark";

const FEATURES = [
  {
    icon: Cpu,
    title: "AI Architecture Generation",
    text: "Describe your system, AI maps it to nodes and edges on a live canvas.",
  },
  {
    icon: Users,
    title: "Real-time Collaboration",
    text: "Live cursors, presence indicators, and shared node editing across your team.",
  },
  {
    icon: FileText,
    title: "Instant Spec Generation",
    text: "Export a complete Markdown technical spec directly from the canvas graph.",
  },
];

// Two panels on large screens (pitch left, form right); the form alone on small ones.
const AuthShell = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-screen bg-base text-copy-primary">
    <div className="hidden flex-col justify-between border-r border-surface-border bg-surface p-16 lg:flex lg:w-1/2">
      <Link href="/" aria-label="Ghost AI home" className="w-fit rounded-xl focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring">
        <BrandMark />
      </Link>

      <div className="my-auto max-w-lg space-y-10">
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Design systems at the
            <br />
            speed of thought.
          </h1>
          <p className="text-[1rem] leading-relaxed text-copy-muted">
            Describe your architecture in plain English. Ghost AI maps it to a shared canvas your whole
            team can refine in real time.
          </p>
        </div>

        <ul className="space-y-8">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-border-subtle bg-elevated text-brand">
                <Icon className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-copy-primary">{title}</h3>
                <p className="text-xs leading-relaxed text-copy-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-copy-faint">Collaborative system design workspace.</p>
    </div>

    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  </div>
);

export default AuthShell;
