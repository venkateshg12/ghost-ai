"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ClientSideSuspense, LiveblocksProvider, RoomProvider } from "@liveblocks/react/suspense";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authorizeRoom } from "@/api/liveblocks";
import type { ApiError } from "@/types";

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

const RoomLoading = () => (
  <div className="flex flex-1 items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-7 w-7 animate-spin text-brand" />
      <span className="font-mono text-xs uppercase tracking-wider text-copy-muted">Connecting to room...</span>
    </div>
  </div>
);

/*
  Room tokens come from the API's /liveblocks/auth, which checks project membership first. A 403
  there is reported to Liveblocks as "forbidden" (it stops retrying) rather than as a crash.
 */
const authEndpoint = async (room?: string) => {
  try {
    return await authorizeRoom(room);
  } catch (error) {
    const failure = error as ApiError;
    if (failure.status === 403 || failure.status === 404) {
      return { error: "forbidden" as const, reason: failure.message };
    }
    throw error;
  }
};

const WorkspaceRoom = ({ roomId, children }: { roomId: string; children: ReactNode }) => (
  <RoomErrorBoundary>
    <LiveblocksProvider authEndpoint={authEndpoint}>
      <RoomProvider id={roomId} initialPresence={{ cursor: null, thinking: false, isThinking: false }}>
        <ClientSideSuspense fallback={<RoomLoading />}>{children}</ClientSideSuspense>
      </RoomProvider>
    </LiveblocksProvider>
  </RoomErrorBoundary>
);

export default WorkspaceRoom;
