import { describe, expect, it } from "vitest";
import { computePlanCacheKey } from "./design";
import { buildNode, type FlowGraph } from "./graph";

describe("computePlanCacheKey", () => {
    const graphA: FlowGraph = {
        nodes: [buildNode({ id: "client", label: "Web Client", shape: "pill", x: 0, y: 0 })],
        edges: [],
    };

    const graphB: FlowGraph = {
        nodes: [buildNode({ id: "client", label: "Web Client", shape: "pill", x: 0, y: 0 })],
        edges: [],
    };

    const graphRenamed: FlowGraph = {
        nodes: [buildNode({ id: "client", label: "Mobile Client", shape: "pill", x: 0, y: 0 })],
        edges: [],
    };

    it("generates identical keys for same graph and same prompt", () => {
        const key1 = computePlanCacheKey("proj-1", "add a db", graphA);
        const key2 = computePlanCacheKey("proj-1", "add a db", graphB);
        expect(key1).toBe(key2);
    });

    it("generates different keys when node label changes", () => {
        const key1 = computePlanCacheKey("proj-1", "add a db", graphA);
        const key2 = computePlanCacheKey("proj-1", "add a db", graphRenamed);
        expect(key1).not.toBe(key2);
    });

    it("generates different keys for different project ids", () => {
        const key1 = computePlanCacheKey("proj-1", "add a db", graphA);
        const key2 = computePlanCacheKey("proj-2", "add a db", graphA);
        expect(key1).not.toBe(key2);
    });

    it("generates different keys for different focusNodeIds", () => {
        const key1 = computePlanCacheKey("proj-1", "add a db", graphA, ["client"]);
        const key2 = computePlanCacheKey("proj-1", "add a db", graphA, []);
        expect(key1).not.toBe(key2);
    });
});
