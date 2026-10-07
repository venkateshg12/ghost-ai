import type { EditorStore } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";

/*
  Editor UI state shared by the navbar, sidebars, dialogs and canvas. Server data (projects, members,
  specs) is not kept here — that belongs to TanStack Query.
 */
export const useEditorStore = create<EditorStore>()(
    devtools(
        (set) => ({
            sidebarOpen: true,
            aiSidebarOpen: false,
            dialog: null,
            dialogProject: null,
            saveStatus: "idle",

            setSidebarOpen: (open) => set({ sidebarOpen: open }, false, "setSidebarOpen"),
            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen }), false, "toggleSidebar"),
            setAiSidebarOpen: (open) => set({ aiSidebarOpen: open }, false, "setAiSidebarOpen"),
            toggleAiSidebar: () => set((state) => ({ aiSidebarOpen: !state.aiSidebarOpen }), false, "toggleAiSidebar"),
            openDialog: (dialog, project = null) => set({ dialog, dialogProject: project }, false, "openDialog"),
            closeDialog: () => set({ dialog: null }, false, "closeDialog"),
            setSaveStatus: (saveStatus) => set({ saveStatus }, false, "setSaveStatus"),
        }),
        { name: "EditorStore" }
    )
);
