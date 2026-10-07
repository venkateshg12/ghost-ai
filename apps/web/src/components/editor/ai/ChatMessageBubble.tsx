import { Ghost } from "lucide-react";
import { cn, initialsOf } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/ai/useAiFeeds";

const timeOf = (createdAt: number) =>
  new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const ChatMessageBubble = ({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) => {
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
          <img src={message.sender.avatar} alt={message.sender.name} className="h-full w-full object-cover" />
        ) : (
          <span className="font-mono text-[9px] font-bold text-copy-secondary">{initialsOf(message.sender.name)}</span>
        )}
      </div>

      <div className={cn("flex max-w-[85%] flex-col", isOwn ? "items-end" : "items-start")}>
        <span className="mb-1 px-1 font-mono text-[10px] font-semibold text-copy-muted">
          {isOwn ? "You" : message.sender.name} · {timeOf(message.createdAt)}
        </span>
        <div
          className={cn(
            "whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-sm",
            isAssistant
              ? "rounded-tl-none border border-surface-border bg-elevated text-ai-text"
              : isOwn
                ? "rounded-tr-none border border-state-success/50 bg-state-success/15 text-copy-primary"
                : "rounded-tl-none border border-surface-border-subtle bg-subtle text-copy-primary"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
};

export default ChatMessageBubble;
