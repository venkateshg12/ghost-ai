"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import {
  Hammer,
  ImagePlus,
  Loader2,
  MessageCircleQuestion,
  SendHorizontal,
  Square,
  X,
} from "lucide-react";
import { IMAGE_TYPES, type AiMode } from "@repo/types";
import { cn } from "@/lib/utils";

const MAX_LENGTH = 2000;
// The counter only appears near the limit, where it is useful; the rest of the time it is noise.
const COUNTER_FROM = 1700;
const MAX_HEIGHT_PX = 144;

export interface SlashCommand {
  name: string;
  description: string;
  /** Takes text after the name (/ask why…) rather than running on its own (/undo). */
  takesText?: boolean;
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mode: AiMode;
  onModeChange: (mode: AiMode) => void;
  commands: SlashCommand[];
  /** A command with no text was chosen from the menu. */
  onCommand: (name: string) => void;
  /** An AI run is active in the room: input is locked for everyone. */
  busy: boolean;
  /** This user may stop the active run (they started it, or own the project). */
  onStop?: () => void;
  stopping?: boolean;
  /** A sketch to turn into a diagram, picked or pasted by the user. */
  attachment?: { name: string; previewUrl: string } | null;
  onAttach?: (file: File) => void;
  onRemoveAttachment?: () => void;
}

const MODES: {
  id: AiMode;
  label: string;
  icon: typeof Hammer;
  placeholder: string;
  hint: string;
}[] = [
  {
    id: "build",
    label: "Build",
    icon: Hammer,
    placeholder: "Describe a system to design…",
    hint: "Edits the canvas",
  },
  {
    id: "ask",
    label: "Ask",
    icon: MessageCircleQuestion,
    placeholder: "Ask about this architecture…",
    hint: "Answers, never changes the canvas",
  },
];

const Key = ({ label, children }: { label: string; children: string }) => (
  <kbd
    title={label}
    className="rounded-xl border border-surface-border-subtle bg-elevated px-1.5 py-px font-mono text-[10px] font-medium text-copy-secondary"
  >
    {children}
  </kbd>
);

/*
  The prompt box. One row to start with, growing with the text up to a cap and then scrolling. Enter
  sends, Shift+Enter adds a line. A Build | Ask switch decides whether the AI edits the canvas or only
  answers, and typing "/" opens a command menu. While an AI run is active the box is locked and Send
  becomes Stop.
 */
const ChatComposer = ({
  value,
  onChange,
  onSubmit,
  mode,
  onModeChange,
  commands,
  onCommand,
  busy,
  onStop,
  stopping,
  attachment,
  onAttach,
  onRemoveAttachment,
}: ChatComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  // A sketch can be sent with no text at all: the AI is told to turn it into a diagram.
  const canSend = !busy && (value.trim().length > 0 || Boolean(attachment));
  const current = MODES.find((candidate) => candidate.id === mode)!;

  // Grow with the content, within the cap.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  // The command menu is open while the text is "/" plus the start of a command name, nothing more.
  const query =
    value.startsWith("/") && !value.includes(" ")
      ? value.slice(1).toLowerCase()
      : null;
  const matches = useMemo(
    () =>
      query === null
        ? []
        : commands.filter((command) => command.name.startsWith(query)),
    [commands, query],
  );
  const menuOpen = !busy && !dismissed && matches.length > 0;

  useEffect(() => {
    setActiveIndex(0);
    setDismissed(false);
  }, [query]);

  const choose = (command: SlashCommand) => {
    if (command.takesText) {
      onChange(`/${command.name} `);
      textareaRef.current?.focus();
    } else {
      onChange("");
      onCommand(command.name);
    }
  };

  // Pasting a screenshot (e.g. a whiteboard photo from the clipboard) attaches it.
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!onAttach) return;
    const file = [...event.clipboardData.files].find((candidate) =>
      (IMAGE_TYPES as readonly string[]).includes(candidate.type),
    );
    if (file) {
      event.preventDefault();
      onAttach(file);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActiveIndex(
          (index) => (index + step + matches.length) % matches.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        choose(matches[activeIndex]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDismissed(true);
        return;
      }
    }
    // `isComposing` keeps Enter from sending while an IME is still choosing characters.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  };

  const remaining = MAX_LENGTH - value.length;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
      onClick={() => textareaRef.current?.focus()}
      className={cn(
        "relative mx-3 mb-3 cursor-text rounded-2xl border border-surface-border-subtle bg-base transition-[border-color,box-shadow] duration-150",
        "focus-within:border-state-success/60 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--state-success)_15%,transparent)]",
        busy && "cursor-default opacity-90",
      )}
    >
      {menuOpen && (
        <ul
          role="listbox"
          aria-label="Commands"
          className="absolute bottom-full left-0 right-0 z-10 mb-2 overflow-hidden rounded-2xl border border-surface-border-subtle bg-elevated p-1 shadow-2xl"
        >
          {matches.map((command, index) => (
            <li
              key={command.name}
              role="option"
              aria-selected={index === activeIndex}
            >
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(command)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-baseline gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors",
                  index === activeIndex
                    ? "bg-ai/15 text-copy-primary"
                    : "text-copy-secondary",
                )}
              >
                <span className="font-mono text-xs font-semibold text-ai-text">
                  /{command.name}
                </span>
                <span className="truncate text-[11px] text-copy-muted">
                  {command.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        role="radiogroup"
        aria-label="Mode"
        className="flex items-center gap-1 px-2.5 pt-2.5"
      >
        {MODES.map(({ id, label, icon: Icon, hint }) => {
          const selected = id === mode;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              title={hint}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                onModeChange(id);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50 disabled:cursor-not-allowed",
                selected
                  ? "bg-ai text-white"
                  : "text-copy-muted hover:bg-elevated hover:text-copy-secondary",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>

      {attachment && (
        <div className="mx-2.5 mt-2 flex items-center gap-2 rounded-xl border border-surface-border-subtle bg-elevated p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a remote image */}
          <img
            src={attachment.previewUrl}
            alt=""
            className="h-9 w-9 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] text-copy-primary">
              {attachment.name}
            </p>
            <p className="font-mono text-[10px] text-copy-muted">
              Sketch → diagram
            </p>
          </div>
          <button
            type="button"
            aria-label="Remove image"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onRemoveAttachment?.();
            }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl text-copy-muted transition-colors hover:bg-subtle hover:text-copy-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        onPaste={handlePaste}
        value={value}
        rows={1}
        disabled={busy}
        spellCheck={false}
        maxLength={MAX_LENGTH}
        aria-label="Message Ghost AI"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          busy
            ? "Ghost AI is working…"
            : attachment
              ? "Add an instruction (optional)…"
              : current.placeholder
        }
        className="nodrag nopan block max-h-36 min-h-10 w-full resize-none bg-transparent px-3.5 pb-1 pt-2 font-sans text-[13px] leading-relaxed text-copy-primary outline-hidden placeholder:text-copy-faint disabled:cursor-not-allowed"
      />

      <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1">
        {onAttach && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={IMAGE_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAttach(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              title="Attach a sketch or whiteboard photo"
              aria-label="Attach an image"
              onClick={(event) => {
                event.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-copy-muted transition-colors hover:bg-elevated hover:text-copy-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ai/50 disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
          </>
        )}
        <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap font-mono text-[10px] text-copy-muted">
          <Key label="Enter">Enter</Key>
          <span>send</span>
          <span aria-hidden="true" className="text-copy-faint">
            ·
          </span>
          <Key label="Slash">/</Key>
          <span className="truncate">commands</span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          {value.length >= COUNTER_FROM && (
            <span
              className={cn(
                "font-mono text-[10px] tabular-nums",
                remaining <= 50 ? "text-state-warning" : "text-copy-faint",
              )}
              aria-live="polite"
            >
              {remaining}
            </span>
          )}

          {busy && onStop ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onStop();
              }}
              disabled={stopping}
              aria-label="Stop generating"
              title="Stop generating"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-state-error/15 text-state-error transition-colors hover:bg-state-error/25 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-state-error/50 disabled:opacity-60"
            >
              {stopping ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5 fill-current" />
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label={busy ? "Ghost AI is working" : "Send message"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-state-success/50",
                canSend
                  ? "bg-state-success text-primary-foreground hover:bg-state-success/90"
                  : "bg-subtle text-copy-faint",
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};

export default ChatComposer;
