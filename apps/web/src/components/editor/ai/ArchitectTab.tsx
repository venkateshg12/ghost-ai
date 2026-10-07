"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import type { AiRunStarted, ProjectSummary } from "@repo/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiFeeds } from "@/hooks/ai/useAiFeeds";
import { useStartDesign } from "@/hooks/ai/useStartDesign";
import { useAuthStore } from "@/store/auth.store";
import ChatMessageBubble from "./ChatMessageBubble";
import RunWatcher from "./RunWatcher";
import StatusStrip from "./StatusStrip";

const STARTER_PROMPTS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
];

const MIN_INPUT_HEIGHT = 72;
const MAX_INPUT_HEIGHT = 160;

/*
  Room chat plus the design prompt. A message goes to the shared `ai-chat` feed (so everyone sees
  it), then starts a design run. The AI's changes reach the canvas through Liveblocks on their own —
  nothing here touches nodes or edges. While any run is active in the room, input is locked for all.
 */
const ArchitectTab = ({ project }: { project: ProjectSummary }) => {
  const user = useAuthStore((state) => state.user);
  const { chat, latestStatus, isRoomGenerating, sendChatMessage } = useAiFeeds();
  const startDesign = useStartDesign();
  const [activeRun, setActiveRun] = useState<AiRunStarted | null>(null);
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The starter's own run (tracked through Trigger.dev realtime) or anyone's run in this room.
  const isGenerating = Boolean(activeRun) || isRoomGenerating || startDesign.isPending;

  const handleRunFinished = useCallback(() => setActiveRun(null), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(Math.max(element.scrollHeight, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT)}px`;
  }, [input]);

  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || isGenerating || !user) return;
    setSendError(null);

    try {
      await sendChatMessage({
        type: "chat",
        role: "user",
        content: prompt,
        sender: { id: user.id, name: user.name, avatar: user.avatar },
      });
    } catch {
      setSendError("Your message couldn't be sent. Check your connection and try again.");
      return;
    }
    setInput("");

    startDesign.mutate(
      { roomId: project.id, prompt },
      {
        onSuccess: (response) => setActiveRun(response.data),
        // Failures to start are part of the conversation, so they go to the shared chat.
        onError: (error) =>
          void sendChatMessage({
            type: "chat",
            role: "assistant",
            content: `I couldn't start that design: ${error.message}`,
            sender: { id: "ghost-ai", name: "Ghost AI", color: "#6457f9" },
          }).catch(() => setSendError(error.message)),
      }
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  const statusText = latestStatus?.text ?? "Ghost AI is working…";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {activeRun && <RunWatcher run={activeRun} onFinished={handleRunFinished} />}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {chat.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ai/30 bg-ai/15 text-ai-text shadow-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div className="max-w-[220px] space-y-1">
              <p className="font-mono text-xs font-semibold text-copy-primary">System Architecture Assistant</p>
              <p className="text-[11px] leading-relaxed text-copy-muted">
                Describe a system in plain English or pick a starter prompt to generate it on the canvas.
              </p>
            </div>
            <div className="w-full space-y-2 pt-2">
              <p className="text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-copy-muted">Starter prompts</p>
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void send(prompt)}
                  className="w-full rounded-full border border-surface-border-subtle bg-subtle px-3 py-2 text-left font-mono text-xs text-ai-text transition-colors hover:border-ai/50 hover:text-copy-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chat.map((message) => <ChatMessageBubble key={message.id} message={message} isOwn={message.sender.id === user?.id} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-surface-border bg-elevated/20 pt-3">
        {isGenerating && <StatusStrip text={statusText} />}
        {sendError && <p className="mx-3 mb-2 text-[11px] text-state-error">{sendError}</p>}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
          className="mx-3 mb-3 flex flex-col gap-2 rounded-2xl border border-surface-border-subtle bg-base p-2.5 transition-colors focus-within:border-state-success/50"
        >
          <Textarea
            ref={textareaRef}
            value={input}
            disabled={isGenerating}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
            placeholder={isGenerating ? "AI generation in progress..." : "Ask Ghost AI to design system components..."}
            className="nodrag nopan max-h-[160px] min-h-[72px] resize-none border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between border-t border-surface-border-subtle/40 pt-1">
            <span className="font-mono text-[9px] text-copy-muted">
              {isGenerating ? "Generating architecture..." : "Enter to send · Shift+Enter for a new line"}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={isGenerating || !input.trim()}
              className="h-7 gap-1 rounded-xl bg-state-success px-3 font-mono text-xs text-primary-foreground hover:bg-state-success/90 disabled:opacity-40"
            >
              {isGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send className="h-3 w-3" />
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ArchitectTab;
