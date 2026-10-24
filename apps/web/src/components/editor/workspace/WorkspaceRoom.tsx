"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle, Loader2, ShieldAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RealtimeProvider, useRoomStatus } from "@/lib/realtime/react";

class RoomErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace connection error:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-state-error/20 bg-state-error/10 text-state-error">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-copy-primary">Couldn&apos;t connect to the canvas</h3>
        <p className="mb-4 mt-2 max-w-xs text-xs leading-relaxed text-copy-muted">
          Check your connection and reload the page. If it keeps happening, the realtime service may be unavailable.
        </p>
        <Button size="sm" onClick={() => window.location.reload()} className="text-xs">
          Reload Page
        </Button>
      </div>
    );
  }
}

const RoomLoading = ({ waking = false }: { waking?: boolean }) => (
  <div className="flex flex-1 items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
      <span className="font-mono text-xs uppercase tracking-wider text-copy-muted">
        {waking ? "Waiting for the server..." : "Connecting to room..."}
      </span>
    </div>
  </div>
);

// Shown over the canvas while the socket is down. Editing continues locally and merges on reconnect.
const ReconnectingPill = () => (
  <div
    role="status"
    className="pointer-events-none absolute left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-surface-border-subtle bg-surface/90 px-3 py-1.5 font-mono text-xs text-copy-secondary shadow-xl backdrop-blur-xl"
  >
    <WifiOff className="h-3.5 w-3.5" />
    Reconnecting… your edits are kept
  </div>
);

const RoomForbidden = () => (
  <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-state-error/20 bg-state-error/10 text-state-error">
      <ShieldAlert className="h-6 w-6" />
    </div>
    <h3 className="text-sm font-bold text-copy-primary">Access Denied</h3>
    <p className="mb-4 mt-2 max-w-xs text-xs leading-relaxed text-copy-muted">
      You do not have access to this project canvas.
    </p>
  </div>
);

const RoomGate = ({ children }: { children: ReactNode }) => {
  const status = useRoomStatus();

  if (status.isForbidden) {
    return <RoomForbidden />;
  }

  // Until the document has arrived once there is nothing to show. After that the canvas stays mounted through
  // a reconnect, with a pill instead of a spinner.
  if (!status.hasSynced) {
    return <RoomLoading waking={status.isReconnecting} />;
  }

  return (
    <>
      {children}
      {!status.isLive && <ReconnectingPill />}
    </>
  );
};

const WorkspaceRoom = ({ roomId, children }: { roomId: string; children: ReactNode }) => (
  <RoomErrorBoundary>
    <RealtimeProvider roomId={roomId} fallback={<RoomLoading />}>
      <RoomGate>{children}</RoomGate>
    </RealtimeProvider>
  </RoomErrorBoundary>
);

export default WorkspaceRoom;
