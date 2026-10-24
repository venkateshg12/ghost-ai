import type { CanvasEdgeStyle, ProjectSummary } from "@repo/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type AiTab = "architect" | "review" | "specs";

export type EditorDialog =
  "create" | "rename" | "delete" | "share" | "templates";

// What the visitor was trying to do when we asked them to sign in. Drives the popup's wording.
export type AuthModalReason = "save" | "share" | "ai";
export type AuthModalMode = "sign-in" | "sign-up";

export interface AuthModalState {
  open: boolean;
  mode: AuthModalMode;
  reason: AuthModalReason | null;
}

export interface DraggedShape {
  type: string;
  width: number;
  height: number;
  // Present for a free-standing line or arrow: its style, with `width`/`height` the run to the right and up.
  edge?: Partial<CanvasEdgeStyle>;
}

export type EditorStore = {
  sidebarOpen: boolean;
  aiSidebarOpen: boolean;
  aiTab: AiTab;
  dialog: EditorDialog | null;
  // The project a rename/delete/share dialog acts on — not necessarily the one that is open.
  dialogProject: ProjectSummary | null;
  saveStatus: SaveStatus;
  // Sign-in prompt for signed-out visitors who reach for something that needs an account.
  authModal: AuthModalState;
  // A freshly created project whose canvas should be filled from the signed-out draft.
  pendingImport: { projectId: string } | null;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAiSidebarOpen: (open: boolean) => void;
  setAiTab: (tab: AiTab) => void;
  toggleAiSidebar: () => void;
  openDialog: (dialog: EditorDialog, project?: ProjectSummary | null) => void;
  closeDialog: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  openAuthModal: (reason?: AuthModalReason, mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
  setPendingImport: (value: { projectId: string } | null) => void;
};
