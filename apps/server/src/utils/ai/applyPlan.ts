import { RunCancelledError } from "./runWithFallback";
import type { DesignOperation } from "./design";
import { editFlow } from "./flow";
import { buildEdge, buildNode, sizeOf, toColorPair, toShape, MAX_NODE_SIZE, MIN_NODE_SIZE, type FlowNode } from "./graph";

type Flow = Parameters<Parameters<typeof editFlow>[1]>[0];
type Point = { x: number; y: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const centerOf = (node: FlowNode): Point => {
    const { width, height } = sizeOf(node);
    return { x: node.position.x + width / 2, y: node.position.y + height / 2 };
};

/*
  Applies one operation inside an open flow edit. Every field the model produced is re-checked here:
  an id that doesn't exist, an edge to nowhere or a size out of bounds is skipped or clamped, never
  written. Returns where the AI's cursor should point afterwards, or null if the operation was skipped.
 */
const applyOne = (flow: Flow, op: DesignOperation, positions: Map<string, Point>): Point | null => {
    const existing = flow.getNode(op.id);

    switch (op.type) {
        case "add_node": {
            if (existing) {
                // The model re-added a node that's already there: treat it as an update.
                flow.updateNodeData(op.id, {
                    ...(op.label ? { label: op.label } : {}),
                    ...(op.shape ? { shape: toShape(op.shape) } : {}),
                });
                return centerOf(existing);
            }
            const placed = positions.get(op.id);
            const rightmost = flow.nodes.reduce((max, node) => Math.max(max, node.position.x + sizeOf(node).width), 0);
            const node = buildNode({
                id: op.id,
                label: op.label ?? "",
                shape: op.shape,
                color: op.color,
                x: placed?.x ?? op.x ?? rightmost + 100,
                y: placed?.y ?? op.y ?? 80,
                width: op.width,
                height: op.height,
            });
            flow.addNode(node);
            return centerOf(node);
        }
        case "update_node": {
            if (!existing) return null;
            const colors = op.color ? toColorPair(op.color) : null;
            flow.updateNodeData(op.id, {
                ...(op.label !== undefined ? { label: op.label } : {}),
                ...(op.shape ? { shape: toShape(op.shape) } : {}),
                ...(colors ? { color: colors.bg, textColor: colors.text } : {}),
            });
            return centerOf(existing);
        }
        case "move_node": {
            if (!existing || op.x === undefined || op.y === undefined) return null;
            const position = { x: Math.round(op.x), y: Math.round(op.y) };
            flow.updateNode(op.id, { position });
            return centerOf({ ...existing, position });
        }
        case "resize_node": {
            if (!existing || op.width === undefined || op.height === undefined) return null;
            const width = clamp(op.width, MIN_NODE_SIZE.width, MAX_NODE_SIZE.width);
            const height = clamp(op.height, MIN_NODE_SIZE.height, MAX_NODE_SIZE.height);
            flow.updateNode(op.id, (node) => ({ ...node, style: { ...node.style, width, height } }));
            return centerOf(existing);
        }
        case "delete_node": {
            if (!existing) return null;
            // Edges attached to a removed node would dangle, so they go with it.
            const attached = flow.edges.filter((edge) => edge.source === op.id || edge.target === op.id).map((edge) => edge.id);
            flow.removeEdges(attached);
            flow.removeNode(op.id);
            return centerOf(existing);
        }
        case "add_edge": {
            if (!op.source || !op.target || op.source === op.target) return null;
            const source = flow.getNode(op.source);
            if (!source || !flow.getNode(op.target)) return null;
            flow.addEdge(buildEdge({ id: op.id, source: op.source, target: op.target, label: op.label }));
            return centerOf(source);
        }
        case "delete_edge": {
            if (!flow.getEdge(op.id)) return null;
            flow.removeEdge(op.id);
            return null;
        }
    }
};

const NODE_LEVEL = new Set<DesignOperation["type"]>(["add_node", "update_node", "move_node", "resize_node"]);

/*
  Splits the operations into the groups that are written together. Every write opens a connection to the
  room (0.35s to several seconds), so one-at-a-time was as slow as the model: 14 nodes took 10.6s, against
  1.4s in four groups and 0.2s in one. The nodes still appear in a few steps rather than all at once, and
  everything that depends on them (edges, deletions) goes last, in a single write.
 */
export const BATCH_STEPS = 4;
export const MIN_BATCH_SIZE = 3;

export const planBatches = (operations: readonly DesignOperation[]): DesignOperation[][] => {
    const nodeOps = operations.filter((op) => NODE_LEVEL.has(op.type));
    const rest = operations.filter((op) => !NODE_LEVEL.has(op.type));

    const size = Math.max(MIN_BATCH_SIZE, Math.ceil(nodeOps.length / BATCH_STEPS));
    const batches: DesignOperation[][] = [];
    for (let index = 0; index < nodeOps.length; index += size) batches.push(nodeOps.slice(index, index + size));
    if (rest.length) batches.push([...rest]);
    return batches;
};

export interface ApplyOptions {
    /** Where new nodes go (see placeNewNodes). */
    positions?: Map<string, Point>;
    /** Called after each written group, e.g. to move the AI's cursor. Not awaited: it must never slow the drawing. */
    onStep?: (info: { applied: number; total: number; cursor: Point | null }) => void;
    /** A short pause between groups so collaborators see the design appear in steps. */
    stepDelayMs?: number;
    signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Writes a plan to the room, group by group (see planBatches). */
export const applyPlan = async (roomId: string, operations: readonly DesignOperation[], options: ApplyOptions = {}) => {
    const { positions = new Map(), onStep, stepDelayMs = 150, signal } = options;
    const batches = planBatches(operations);
    const total = operations.length;
    let applied = 0;

    for (const [index, batch] of batches.entries()) {
        if (signal?.aborted) throw new RunCancelledError();

        let cursor: Point | null = null;
        let appliedInBatch = 0;
        await editFlow(roomId, (flow) => {
            for (const op of batch) {
                const at = applyOne(flow, op, positions);
                if (at) {
                    appliedInBatch++;
                    cursor = at;
                }
            }
        });

        applied += appliedInBatch;
        onStep?.({ applied, total, cursor });
        if (index < batches.length - 1) await sleep(stepDelayMs);
    }

    return { applied };
};
