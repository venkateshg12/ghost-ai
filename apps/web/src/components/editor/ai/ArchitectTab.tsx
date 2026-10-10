"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { Bot } from "lucide-react";
import {
  suggestPrompts,
  type AiMode,
  type AiRunStarted,
  type ProjectSummary,
} from "@repo/types";
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@repo/types";
import { useAiFeeds } from "@/hooks/ai/useAiFeeds";
import { useCancelRun } from "@/hooks/ai/useCancelRun";
import { useRevertRun } from "@/hooks/ai/useRevertRun";
import { useStartDesign } from "@/hooks/ai/useStartDesign";
import { useStartImageDesign } from "@/hooks/ai/useStartImageDesign";
import { useAuthStore } from "@/store/auth.store";
import { useEditorStore } from "@/store/editor.store";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";
import ChatComposer, { type SlashCommand } from "./ChatComposer";
import ChatMessageBubble from "./ChatMessageBubble";
import RunWatcher from "./RunWatcher";
import StarterPrompts from "./StarterPrompts";
import StatusStrip from "./StatusStrip";

const COMMANDS: SlashCommand[] = [
  { name: "build", description: "Change the canvas", takesText: true },
  { name: "ask", description: "Ask a question, no changes", takesText: true },
  { name: "review", description: "Review the architecture" },
  { name: "undo", description: "Undo the last AI change" },
];

// `/ask why…` and `/build add a cache` pick the mode for that one message.
const MODE_PREFIX = /^\/(ask|build)\s+([\s\S]+)$/i;

/*
  Room chat plus the AI prompt. A message goes to the shared `ai-chat` feed (so everyone sees it), then
  starts a run: Build edits the canvas, Ask answers without touching it. Replies stream into the same
  feed. While any run is active in the room, input is locked for all, and Stop is offered.
 */
const ArchitectTab = ({ project }: { project: ProjectSummary }) => {
  const user = useAuthStore((state) => state.user);
  const { chat, latestStatus, isRoomGenerating, sendChatMessage } =
    useAiFeeds();
  const { getNodes, getEdges } = useReactFlow<CanvasFlowNode, CanvasFlowEdge>();
  // Only the size matters for re-rendering; the data is read when needed.
  const nodeCount = useStore((state) => state.nodes.length);
  const setAiTab = useEditorStore((state) => state.setAiTab);
  const startDesign = useStartDesign();
  const startImageDesign = useStartImageDesign();
  const cancelRun = useCancelRun();
  const revertRun = useRevertRun();
  const [activeRun, setActiveRun] = useState<AiRunStarted | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AiMode>("build");
  const [notice, setNotice] = useState<string | null>(null);
  // A sketch waiting to be sent. The preview is a blob URL, released when it is removed or sent.
  const [attachment, setAttachment] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // The starter's own run (tracked through Trigger.dev realtime) or anyone's run in this room.
  const isGenerating =
    Boolean(activeRun) ||
    isRoomGenerating ||
    startDesign.isPending ||
    startImageDesign.isPending;
  // Whoever started the run knows its id; everyone else learns it from the status feed (the server decides who may stop it).
  const stoppableRunId =
    activeRun?.runId ?? (isRoomGenerating ? latestStatus?.runId : undefined);

  const handleRunFinished = useCallback(() => setActiveRun(null), []);

  // Follow the newest message, including while a reply streams in.
  const lastLength = chat[chat.length - 1]?.content.length ?? 0;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, lastLength]);

  const graphInput = useMemo(
    () => ({
      nodes: getNodes().map((node) => ({
        id: node.id,
        label: node.data.label,
        shape: node.data.shape,
      })),
      edges: getEdges().map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.data?.label,
      })),
    }),
    // Re-derive when the amount of content changes; moving nodes around does not change the suggestions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeCount, getNodes, getEdges],
  );
  const emptyStatePrompts = useMemo(
    () => suggestPrompts(graphInput),
    [graphInput],
  );

  // Undo is offered on the newest AI change only, matching what the server allows.
  const latestUndoableId = useMemo(
    () =>
      [...chat].reverse().find((message) => message.canUndo && message.runId)
        ?.id,
    [chat],
  );
  const latestSuggestionId = useMemo(
    () =>
      [...chat]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" && message.suggestions?.length,
        )?.id,
    [chat],
  );
  const lastMessageId = chat[chat.length - 1]?.id;

  const removeAttachment = useCallback(() => {
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }, []);

  // Release the preview if the tab goes away with a sketch still attached.
  const attachmentRef = useRef(attachment);
  attachmentRef.current = attachment;
  useEffect(
    () => () => {
      if (attachmentRef.current)
        URL.revokeObjectURL(attachmentRef.current.previewUrl);
    },
    [],
  );

  const attach = (file: File) => {
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setNotice("Only PNG, JPEG and WebP images can be turned into a diagram.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setNotice(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${IMAGE_MAX_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }
    setNotice(null);
    setAttachment((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    // A sketch is always a Build action: it changes the canvas.
    setMode("build");
  };

  // Sketch to diagram: the image goes to the server, the conversation shows what was sent.
  const sendSketch = async (file: File, instruction: string) => {
    if (isGenerating || !user) return;
    setNotice(null);
    const content = instruction
      ? `Sketch: ${file.name}\n${instruction}`
      : `Sketch: ${file.name}`;
    try {
      await sendChatMessage({
        type: "chat",
        role: "user",
        content,
        sender: { id: user.id, name: user.name, avatar: user.avatar },
      });
    } catch {
      setNotice(
        "Your message couldn't be sent. Check your connection and try again.",
      );
      return;
    }
    setInput("");
    removeAttachment();
    startImageDesign.mutate(
      {
        roomId: project.id,
        file,
        ...(instruction ? { prompt: instruction } : {}),
      },
      {
        onSuccess: (response) => setActiveRun(response.data),
        onError: (error) =>
          void sendChatMessage({
            type: "chat",
            role: "assistant",
            content: `I couldn't read that image: ${error.message}`,
            sender: { id: "ghost-ai", name: "Ghost AI", color: "#6457f9" },
          }).catch(() => setNotice(error.message)),
      },
    );
  };

  const send = async (raw: string) => {
    let prompt = raw.trim();
    let runMode = mode;
    const prefixed = MODE_PREFIX.exec(prompt);
    if (prefixed) {
      runMode = prefixed[1]!.toLowerCase() as AiMode;
      prompt = prefixed[2]!.trim();
    }
    if (attachment) return void sendSketch(attachment.file, prompt);
    if (!prompt || isGenerating || !user) return;
    setNotice(null);

    try {
      await sendChatMessage({
        type: "chat",
        role: "user",
        content: prompt,
        sender: { id: user.id, name: user.name, avatar: user.avatar },
      });
    } catch {
      setNotice(
        "Your message couldn't be sent. Check your connection and try again.",
      );
      return;
    }
    setInput("");

    // The selection is a hint for the model; the server keeps only ids that exist in the room.
    const focusNodeIds = getNodes()
      .filter((node) => node.selected)
      .map((node) => node.id)
      .slice(0, 20);

    startDesign.mutate(
      {
        roomId: project.id,
        prompt,
        mode: runMode,
        ...(focusNodeIds.length ? { focusNodeIds } : {}),
      },
      {
        onSuccess: (response) => setActiveRun(response.data),
        // Failures to start are part of the conversation, so they go to the shared chat.
        onError: (error) =>
          void sendChatMessage({
            type: "chat",
            role: "assistant",
            content: `I couldn't start that: ${error.message}`,
            sender: { id: "ghost-ai", name: "Ghost AI", color: "#6457f9" },
          }).catch(() => setNotice(error.message)),
      },
    );
  };

  const undo = (runId: string) => {
    setNotice(null);
    revertRun.mutate(runId, { onError: (error) => setNotice(error.message) });
  };

  const handleCommand = (name: string) => {
    if (name === "review") {
      setAiTab("review");
      return;
    }
    if (name === "undo") {
      const target = chat.find((message) => message.id === latestUndoableId);
      if (target?.runId) undo(target.runId);
      else setNotice("There is no AI change to undo.");
    }
  };

  const stop = () => {
    if (!stoppableRunId) return;
    setNotice(null);
    cancelRun.mutate(stoppableRunId, {
      onSuccess: () => setActiveRun(null),
      onError: (error) => setNotice(error.message),
    });
  };

  const statusText = latestStatus?.text ?? "Ghost AI is working…";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {activeRun && (
        <RunWatcher run={activeRun} onFinished={handleRunFinished} />
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {chat.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ai/30 bg-ai/15 text-ai-text shadow-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div className="max-w-57.5 space-y-1">
              <p className="font-mono text-xs font-semibold text-copy-primary">
                System Architecture Assistant
              </p>
              <p className="text-[11px] leading-relaxed text-copy-muted">
                <span className="font-semibold text-copy-secondary">Build</span>{" "}
                to have it draw on the canvas,{" "}
                <span className="font-semibold text-copy-secondary">Ask</span>{" "}
                to talk through a design.
              </p>
            </div>
            <StarterPrompts
              prompts={emptyStatePrompts}
              title={
                nodeCount === 0
                  ? "Try one of these"
                  : "Suggested for this design"
              }
              disabled={isGenerating}
              onPick={(prompt) => void send(prompt)}
            />
          </div>
        ) : (
          chat.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isOwn={message.sender.id === user?.id}
              showSuggestions={
                message.id === latestSuggestionId &&
                message.id === lastMessageId
              }
              onSuggest={(prompt) => void send(prompt)}
              showUndo={message.id === latestUndoableId}
              onUndo={undo}
              undoing={revertRun.isPending}
              disabled={isGenerating}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-surface-border bg-elevated/20 pt-3">
        {isGenerating && <StatusStrip text={statusText} />}
        {notice && (
          <p className="mx-3 mb-2 text-[11px] text-state-error">{notice}</p>
        )}
        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => void send(input)}
          mode={mode}
          onModeChange={setMode}
          commands={COMMANDS}
          onCommand={handleCommand}
          busy={isGenerating}
          onStop={stoppableRunId ? stop : undefined}
          stopping={cancelRun.isPending}
          attachment={
            attachment
              ? {
                  name: attachment.file.name,
                  previewUrl: attachment.previewUrl,
                }
              : null
          }
          onAttach={attach}
          onRemoveAttachment={removeAttachment}
        />
      </div>
    </div>
  );
};

export default ArchitectTab;
