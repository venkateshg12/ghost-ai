import type { ProjectSummary } from "@repo/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type AiTab = "architect" | "review" | "specs";

export type EditorDialog =
  "create" | "rename" | "delete" | "share" | "templates";

export interface DraggedShape {
  type: string;
  width: number;
  height: number;
}

export type EditorStore = {
  sidebarOpen: boolean;
  aiSidebarOpen: boolean;
  aiTab: AiTab;
  dialog: EditorDialog | null;
  // The project a rename/delete/share dialog acts on — not necessarily the one that is open.
  dialogProject: ProjectSummary | null;
  saveStatus: SaveStatus;

  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setAiSidebarOpen: (open: boolean) => void;
  setAiTab: (tab: AiTab) => void;
  toggleAiSidebar: () => void;
  openDialog: (dialog: EditorDialog, project?: ProjectSummary | null) => void;
  closeDialog: () => void;
  setSaveStatus: (status: SaveStatus) => void;
};
