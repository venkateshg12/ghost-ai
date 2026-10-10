import { describe, expect, it } from "vitest";
import type { DesignOperation } from "./design";
import { MIN_BATCH_SIZE, planBatches } from "./applyPlan";

const node = (id: string): DesignOperation => ({ type: "add_node", id, label: id });
const edge = (id: string, source: string, target: string): DesignOperation => ({ type: "add_edge", id, source, target });
const ids = (batch: DesignOperation[]) => batch.map((op) => op.id);

describe("planBatches", () => {
    it("writes a big design in a handful of groups, not one write per node", () => {
        const nodes = Array.from({ length: 14 }, (_, i) => node(`n${i}`));
        const batches = planBatches([...nodes, edge("e1", "n0", "n1"), edge("e2", "n1", "n2")]);
        expect(batches.length).toBeLessThanOrEqual(5);
        // every operation appears exactly once, and nothing is reordered across the node/edge boundary
        expect(batches.flat()).toHaveLength(16);
        expect(new Set(batches.flat().map((op) => op.id)).size).toBe(16);
    });

    it("puts everything that depends on nodes (edges, deletions) in the last write, after every node", () => {
        const batches = planBatches([node("a"), node("b"), node("c"), node("d"), edge("e1", "a", "b"), { type: "delete_node", id: "old" }]);
        const last = batches[batches.length - 1]!;
        expect(last.map((op) => op.type)).toEqual(["add_edge", "delete_node"]);
        expect(batches.slice(0, -1).flat().every((op) => op.type === "add_node")).toBe(true);
    });

    it("never makes groups smaller than the minimum, so a small design is not split into many writes", () => {
        const batches = planBatches([node("a"), node("b"), node("c"), edge("e1", "a", "b")]);
        expect(batches).toHaveLength(2);
        expect(batches[0]!).toHaveLength(MIN_BATCH_SIZE);
    });

    it("handles an edits-only plan and an empty plan", () => {
        expect(planBatches([edge("e1", "a", "b")])).toEqual([[edge("e1", "a", "b")]]);
        expect(planBatches([])).toEqual([]);
    });

    it("keeps node order inside the groups", () => {
        const nodes = Array.from({ length: 10 }, (_, i) => node(`n${i}`));
        expect(planBatches(nodes).flatMap(ids)).toEqual(nodes.map((n) => n.id));
    });
});
