import { Loader2 } from "lucide-react";

// Compact strip above the input while an AI run is active in the room — visible to everyone.
const StatusStrip = ({ text }: { text: string }) => (
  <div
    className="mx-3 mb-2 flex items-center gap-2 rounded-xl border border-state-success/30 bg-base px-3 py-2 font-mono text-[11px] text-state-success"
    role="status"
    aria-live="polite"
  >
    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
    <span className="truncate">{text}</span>
  </div>
);

export default StatusStrip;
