"use client";

import { useOther } from "@/lib/realtime/react";
import { Loader2 } from "lucide-react";

const FALLBACK_COLOR = "#00c8d4";

interface CollaboratorCursorProps {
  connectionId: string;
}

/*
  One participant's cursor: a pointer and a name badge in their presence colour, with a spinner while
  they (or the AI participant) are generating. Positioning, smoothing and pan/zoom are handled by
  CursorsLayer.
 */
const CollaboratorCursor = ({ connectionId }: CollaboratorCursorProps) => {
  const name = useOther(connectionId, (other) => other?.info?.name ?? "Collaborator");
  const color = useOther(connectionId, (other) => other?.info?.color ?? FALLBACK_COLOR);
  const isThinking = useOther(connectionId, (other) => Boolean(other?.presence.thinking));

  return (
    <div className="pointer-events-none relative select-none">
      <svg className="h-5 w-5 drop-shadow-md" style={{ color }} viewBox="0 0 24 24" fill="currentColor" stroke="white" strokeWidth="1.5" aria-hidden="true">
        <path d="M5.653 22.632l14.93-9.5a1 1 0 00.117-1.636l-18-10.5A1 1 0 001.3 2.152l3.4 19.4a1 1 0 00.953.08z" />
      </svg>
      <div
        className="absolute left-4 top-4 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-white shadow-md"
        style={{ backgroundColor: color }}
      >
        <span>{name}</span>
        {isThinking && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
    </div>
  );
};

export default CollaboratorCursor;
