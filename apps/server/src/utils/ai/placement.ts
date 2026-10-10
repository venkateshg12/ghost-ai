import { layoutGraph } from "@repo/types/layout";
import type { DesignOperation } from "./design";
import { DEFAULT_NODE_SIZE, MAX_NODE_SIZE, MIN_NODE_SIZE, sizeOf, toShape, type FlowGraph } from "./graph";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const nodeSizeFor = (op: Pick<DesignOperation, "shape" | "width" | "height">) => {
    const fallback = DEFAULT_NODE_SIZE[toShape(op.shape)];
    return {
        width: clamp(op.width ?? fallback.width, MIN_NODE_SIZE.width, MAX_NODE_SIZE.width),
        height: clamp(op.height ?? fallback.height, MIN_NODE_SIZE.height, MAX_NODE_SIZE.height),
    };
};

/*
  Positions for the nodes a plan adds. The model decides what is in the diagram; this decides where it
  goes, because models overlap nodes and ignore their sizes. New nodes are laid out as their own
  layered graph: from the top-left on an empty canvas, or to the right of existing work, so nothing
  already drawn is moved or covered.
 */
export const placeNewNodes = (graph: FlowGraph, operations: readonly DesignOperation[]): Map<string, { x: number; y: number }> => {
    const existing = new Set(graph.nodes.map((node) => node.id));
    const adds = operations.filter((op) => op.type === "add_node" && !existing.has(op.id));
    if (adds.length === 0) return new Map();

    const added = new Set(adds.map((op) => op.id));
    const nodes = adds.map((op) => ({ id: op.id, ...nodeSizeFor(op) }));
    const edges = operations
        .filter((op) => op.type === "add_edge" && op.source && op.target && added.has(op.source) && added.has(op.target))
        .map((op) => ({ source: op.source!, target: op.target! }));

    let originX = 80;
    let originY = 80;
    if (graph.nodes.length > 0) {
        originX = Math.max(...graph.nodes.map((node) => node.position.x + sizeOf(node).width)) + 120;
        originY = Math.min(...graph.nodes.map((node) => node.position.y));
    }

    return layoutGraph(nodes, edges, { originX, originY });
};
