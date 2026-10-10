import { describe, expect, it } from "vitest";
import { countPartialPlan } from "./design";

describe("countPartialPlan", () => {
    it("counts components and connections as they appear in a partial plan", () => {
        expect(countPartialPlan(undefined)).toEqual({ nodes: 0, edges: 0 });
        expect(countPartialPlan({ operations: [] })).toEqual({ nodes: 0, edges: 0 });
        expect(
            countPartialPlan({
                operations: [{ type: "add_node", id: "a" }, { type: "add_node", id: "b" }, { type: "add_edge", source: "a", target: "b" }],
            })
        ).toEqual({ nodes: 2, edges: 1 });
    });

    it("ignores elements that are still being written (no id yet, or no endpoints)", () => {
        expect(countPartialPlan({ operations: [{ type: "add_node", id: "a" }, { type: "add_node" }, { type: "add_edge", source: "a" }, undefined] })).toEqual({ nodes: 1, edges: 0 });
    });

    it("does not count edits", () => {
        expect(countPartialPlan({ operations: [{ type: "update_node", id: "a" }, { type: "delete_node", id: "b" }] })).toEqual({ nodes: 0, edges: 0 });
    });
});
