import { create } from "zustand";

/*
  The workspace registers its `saveNow` here so the navbar's Save button — which lives outside the
  Liveblocks room — can trigger the same save the autosave uses.
 */
type CanvasSaveRegistry = {
    saveNow: (() => Promise<void>) | null;
    register: (saveNow: (() => Promise<void>) | null) => void;
};

export const useCanvasSaveStore = create<CanvasSaveRegistry>()((set) => ({
    saveNow: null,
    register: (saveNow) => set({ saveNow }),
}));
