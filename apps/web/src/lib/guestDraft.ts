import { canvasSnapshotSchema } from "@repo/types";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";

/*
  The signed-out canvas. It lives only in this browser's localStorage — nothing here ever reaches the
  server. Every access is wrapped because storage can be missing or throw (private windows, blocked
  site data, a full quota) and the canvas must keep working without it.
 */
const STORAGE_KEY = "plano:guest-draft:v1";

export interface GuestDraft {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
}

// Selection and drag state belong to the moment, not to the saved drawing.
const withoutTransientState = <T extends object>(item: T): T => {
  const copy = { ...item } as Record<string, unknown>;
  delete copy.selected;
  delete copy.dragging;
  delete copy.resizing;
  return copy as T;
};

export const loadGuestDraft = (): GuestDraft | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = canvasSnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return {
      nodes: parsed.data.nodes as unknown as CanvasFlowNode[],
      edges: parsed.data.edges as unknown as CanvasFlowEdge[],
    };
  } catch {
    return null;
  }
};

export const saveGuestDraft = (draft: GuestDraft) => {
  try {
    if (draft.nodes.length === 0 && draft.edges.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes: draft.nodes.map(withoutTransientState),
        edges: draft.edges.map(withoutTransientState),
      })
    );
  } catch {
    // Storage unavailable or full: the drawing stays on screen, it just won't survive a reload.
  }
};

export const clearGuestDraft = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
};

export const hasGuestDraft = () => {
  const draft = loadGuestDraft();
  return Boolean(draft && draft.nodes.length > 0);
};
