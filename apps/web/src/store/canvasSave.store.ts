import { create } from "zustand";

/*
  The workspace registers its `saveNow` here so the navbar's Save button — which lives outside the
  realtime room — can ask the server to save now. It rejects when there is no connection to ask.
 */
type CanvasSaveRegistry = {
    saveNow: (() => Promise<void>) | null;
    register: (saveNow: (() => Promise<void>) | null) => void;
};

export const useCanvasSaveStore = create<CanvasSaveRegistry>()((set) => ({
    saveNow: null,
    register: (saveNow) => set({ saveNow }),
}));
