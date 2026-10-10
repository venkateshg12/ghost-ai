"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";

interface StarterPromptsProps {
  prompts: string[];
  title: string;
  disabled: boolean;
  onPick: (prompt: string) => void;
}

// Shown while the room has no conversation yet: one click sends the prompt. The prompts come from the
// diagram itself (see suggestPrompts), so they stay relevant once something is on the canvas.
const StarterPrompts = ({
  prompts,
  title,
  disabled,
  onPick,
}: StarterPromptsProps) => (
  <div className="w-full space-y-2.5">
    <p className="text-left font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-copy-muted">
      {title}
    </p>
    <ul className="space-y-2">
      {prompts.map((prompt) => (
        <li key={prompt}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(prompt)}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-surface-border-subtle bg-elevated/60 px-3 py-2.5 text-left text-xs text-copy-secondary transition-colors hover:border-ai/50 hover:bg-ai/10 hover:text-copy-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-ai-text" />
            <span className="flex-1">{prompt}</span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-copy-faint transition-all group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-ai-text" />
          </button>
        </li>
      ))}
    </ul>
  </div>
);

export default StarterPrompts;
