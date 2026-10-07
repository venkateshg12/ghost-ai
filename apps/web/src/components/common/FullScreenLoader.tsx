import { Loader2 } from "lucide-react";

const FullScreenLoader = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex min-h-screen w-full items-center justify-center bg-base" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
      <span className="font-mono text-xs uppercase tracking-wider text-copy-muted">{label}</span>
    </div>
  </div>
);

export default FullScreenLoader;
