import * as Y from "yjs";
import { getDocEdgesMap, getDocNodesMap } from "@repo/types";

export const LOCAL_ORIGIN = Symbol("local");

export interface UndoState {
    canUndo: boolean;
    canRedo: boolean;
}

export class FlowUndoManager {
    public readonly manager: Y.UndoManager;
    private listeners = new Set<(state: UndoState) => void>();

    constructor(doc: Y.Doc) {
        const nodes = getDocNodesMap(doc);
        const edges = getDocEdgesMap(doc);

        this.manager = new Y.UndoManager([nodes, edges], {
            trackedOrigins: new Set([LOCAL_ORIGIN]),
            captureTimeout: 500,
        });

        this.manager.on("stack-item-added", () => this.notify());
        this.manager.on("stack-item-popped", () => this.notify());
        this.manager.on("stack-cleared", () => this.notify());
    }

    private notify() {
        const state = this.getState();
        for (const cb of this.listeners) cb(state);
    }

    getState(): UndoState {
        return {
            canUndo: this.manager.canUndo(),
            canRedo: this.manager.canRedo(),
        };
    }

    subscribe(listener: (state: UndoState) => void): () => void {
        this.listeners.add(listener);
        listener(this.getState());
        return () => this.listeners.delete(listener);
    }

    undo(): void {
        this.manager.undo();
    }

    redo(): void {
        this.manager.redo();
    }

    clear(): void {
        this.manager.clear();
    }

    destroy(): void {
        this.manager.destroy();
        this.listeners.clear();
    }
}
