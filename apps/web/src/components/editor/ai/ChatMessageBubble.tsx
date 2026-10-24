import { Ghost, Undo2 } from "lucide-react";
import { cn, initialsOf } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/ai/useAiFeeds";
import MarkdownView from "./MarkdownView";

const timeOf = (createdAt: number) =>
  new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

const seconds = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

interface ChatMessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  /** Offer the follow-up chips (only on the newest reply). */
  showSuggestions?: boolean;
  onSuggest?: (prompt: string) => void;
  /** Offer Undo (only on the newest change that can still be undone). */
  showUndo?: boolean;
  onUndo?: (runId: string) => void;
  undoing?: boolean;
  /** Nothing can be sent while an AI run is active. */
  disabled?: boolean;
}

// Which model answered and how long it took. A fallback is shown plainly, not hidden.
const ModelBadge = ({ meta }: { meta: NonNullable<ChatMessage["meta"]> }) => {
  const tokens =
    meta.inputTokens !== undefined || meta.outputTokens !== undefined
      ? ` · ${meta.inputTokens ?? 0} in / ${meta.outputTokens ?? 0} out tokens`
      : "";
  return (
    <span
      title={`${meta.model}${tokens}`}
      className="mt-1 inline-flex items-center gap-1.5 px-1 font-mono text-[10px] text-copy-faint"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          meta.fellBack ? "bg-state-warning" : "bg-state-success",
        )}
      />
      {meta.label} · {seconds(meta.latencyMs)}
      {meta.cached && (
        <span className="text-ai-text">cached</span>
      )}
      {meta.fellBack && (
        <span className="text-state-warning">backup model</span>
      )}
    </span>
  );
};

const TypingDots = () => (
  <span
    className="inline-flex items-center gap-1 py-1"
    aria-label="Plano is typing"
  >
    {[0, 1, 2].map((index) => (
      <span
        key={index}
        className="h-1.5 w-1.5 animate-pulse rounded-full bg-ai-text"
        style={{ animationDelay: `${index * 150}ms` }}
      />
    ))}
  </span>
);

const ChatMessageBubble = ({
  message,
  isOwn,
  showSuggestions,
  onSuggest,
  showUndo,
  onUndo,
  undoing,
  disabled,
}: ChatMessageBubbleProps) => {
  const isAssistant = message.role === "assistant";

  return (
    <div className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      <div
        className="mt-5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-elevated"
        style={{ borderColor: message.sender.color ?? "var(--border-subtle)" }}
        title={message.sender.name}
      >
        {isAssistant ? (
          <Ghost className="h-3.5 w-3.5 text-ai-text" />
        ) : message.sender.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar hosts vary per user
          <img
            src={message.sender.avatar}
            alt={message.sender.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-mono text-[9px] font-bold text-copy-secondary">
            {initialsOf(message.sender.name)}
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex min-w-0 max-w-[88%] flex-col",
          isOwn ? "items-end" : "items-start",
        )}
      >
        <span className="mb-1 px-1 font-mono text-[10px] font-semibold text-copy-muted">
          {isOwn ? "You" : message.sender.name} · {timeOf(message.createdAt)}
        </span>

        <div
          className={cn(
            "min-w-0 max-w-full rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
            isAssistant
              ? "rounded-tl-none border border-ai/25 bg-elevated text-copy-secondary"
              : isOwn
                ? "whitespace-pre-wrap rounded-tr-none border border-state-success/50 bg-state-success/15 text-copy-primary"
                : "whitespace-pre-wrap rounded-tl-none border border-surface-border-subtle bg-subtle text-copy-primary",
          )}
        >
          {isAssistant ? (
            message.content ? (
              <div className="[&_h1]:mb-2 [&_h1]:mt-1 [&_h1]:text-sm [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:border-0 [&_h2]:pb-0 [&_h2]:text-xs [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-xs [&_li]:text-xs [&_ol]:mb-2 [&_p]:mb-2 [&_p]:text-xs [&_p:last-child]:mb-0 [&_ul]:mb-2">
                <MarkdownView content={message.content} />
                {message.streaming && (
                  <span
                    className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-ai-text align-middle"
                    aria-hidden="true"
                  />
                )}
              </div>
            ) : (
              <TypingDots />
            )
          ) : (
            message.content
          )}
        </div>

        {isAssistant && message.meta && !message.streaming && (
          <ModelBadge meta={message.meta} />
        )}

        {isAssistant && showUndo && message.runId && onUndo && (
          <button
            type="button"
            onClick={() => onUndo(message.runId!)}
            disabled={undoing || disabled}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-xl border border-surface-border-subtle bg-base px-2.5 py-1 font-mono text-[11px] text-copy-secondary transition-colors hover:border-ai/50 hover:text-copy-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50 disabled:opacity-50"
          >
            <Undo2 className="h-3 w-3" />
            {undoing ? "Undoing…" : "Undo this change"}
          </button>
        )}

        {isAssistant && showSuggestions && message.suggestions?.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={disabled}
                onClick={() => onSuggest?.(suggestion)}
                className="rounded-xl border border-surface-border-subtle bg-base px-2.5 py-1 text-left text-[11px] leading-snug text-ai-text transition-colors hover:border-ai/50 hover:bg-ai/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ChatMessageBubble;
