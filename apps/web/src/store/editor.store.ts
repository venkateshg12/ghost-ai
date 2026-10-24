import type { EditorStore } from "@/types";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useAuthStore } from "./auth.store";

const isSignedIn = () => Boolean(useAuthStore.getState().user);

/*
  Editor UI state shared by the navbar, sidebars, dialogs and canvas. Server data (projects, members,
  specs) is not kept here — that belongs to TanStack Query.

  Share and the AI sidebar are for signed-in users only. The guard lives in the actions themselves, so a
  signed-out visitor gets the sign-in popup however they got there, instead of every button having to
  remember to check.
 */
export const useEditorStore = create<EditorStore>()(
  devtools(
    (set, get) => ({
      sidebarOpen: true,
      aiSidebarOpen: false,
      aiTab: "architect",
      dialog: null,
      dialogProject: null,
      saveStatus: "idle",
      authModal: { open: false, mode: "sign-in", reason: null },
      pendingImport: null,

      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }, false, "setSidebarOpen"),
      toggleSidebar: () =>
        set(
          (state) => ({ sidebarOpen: !state.sidebarOpen }),
          false,
          "toggleSidebar",
        ),
      setAiSidebarOpen: (open) =>
        set({ aiSidebarOpen: open }, false, "setAiSidebarOpen"),
      setAiTab: (aiTab) => set({ aiTab }, false, "setAiTab"),
      toggleAiSidebar: () => {
        if (!isSignedIn()) {
          get().openAuthModal("ai");
          return;
        }
        set(
          (state) => ({ aiSidebarOpen: !state.aiSidebarOpen }),
          false,
          "toggleAiSidebar",
        );
      },
      openDialog: (dialog, project = null) => {
        if (dialog === "share" && !isSignedIn()) {
          get().openAuthModal("share");
          return;
        }
        set({ dialog, dialogProject: project }, false, "openDialog");
      },
      closeDialog: () => set({ dialog: null }, false, "closeDialog"),
      setSaveStatus: (saveStatus) =>
        set({ saveStatus }, false, "setSaveStatus"),
      openAuthModal: (reason, mode = "sign-in") =>
        set(
          { authModal: { open: true, mode, reason: reason ?? null } },
          false,
          "openAuthModal",
        ),
      closeAuthModal: () =>
        set(
          (state) => ({ authModal: { ...state.authModal, open: false } }),
          false,
          "closeAuthModal",
        ),
      setAuthModalMode: (mode) =>
        set(
          (state) => ({ authModal: { ...state.authModal, mode } }),
          false,
          "setAuthModalMode",
        ),
      setPendingImport: (pendingImport) =>
        set({ pendingImport }, false, "setPendingImport"),
    }),
    { name: "EditorStore" },
  ),
);
