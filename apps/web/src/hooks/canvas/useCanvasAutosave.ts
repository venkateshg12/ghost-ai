"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Edge, Node } from "@xyflow/react";
import { useEditorStore } from "@/store/editor.store";
import { useSaveCanvas } from "./useSaveCanvas";

const DEBOUNCE_MS = 2000;
// How long "Saved" / "Error" stays on the Save button before it returns to "Save".
const STATUS_RESET_MS = 2500;

interface UseCanvasAutosaveOptions {
    projectId: string;
    nodes: Node[];
    edges: Edge[];
    // Off until the initial load has decided what the room holds, so an empty first render can
    // never overwrite a saved snapshot.
    enabled: boolean;
}

/*
  Debounced snapshot of the live canvas to the API. Status goes to the editor store, where the
  navbar's Save button reads it; `saveNow` is the same save, for that button.
 */
export const useCanvasAutosave = ({ projectId, nodes, edges, enabled }: UseCanvasAutosaveOptions) => {
    const setSaveStatus = useEditorStore((state) => state.setSaveStatus);
    const { mutateAsync } = useSaveCanvas();
    const latest = useRef({ nodes, edges });
    const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const skipNext = useRef(true);

    latest.current = { nodes, edges };

    const saveNow = useCallback(async () => {
        clearTimeout(resetTimer.current);
        setSaveStatus("saving");
        try {
            await mutateAsync({ projectId, snapshot: { ...latest.current } });
            setSaveStatus("saved");
        } catch {
            setSaveStatus("error");
        }
        resetTimer.current = setTimeout(() => setSaveStatus("idle"), STATUS_RESET_MS);
    }, [mutateAsync, projectId, setSaveStatus]);

    useEffect(() => {
        if (!enabled) return;
        // The first change after enabling is the state we just loaded — nothing new to save.
        if (skipNext.current) {
            skipNext.current = false;
            return;
        }
        const timer = setTimeout(() => void saveNow(), DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [nodes, edges, enabled, saveNow]);

    useEffect(() => () => {
        clearTimeout(resetTimer.current);
        setSaveStatus("idle");
    }, [setSaveStatus]);

    return { saveNow };
};
