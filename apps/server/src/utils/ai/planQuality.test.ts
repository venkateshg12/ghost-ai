import { describe, expect, it } from "vitest";
import type { DesignOperation, DesignPlan } from "./design";
import type { FlowGraph } from "./graph";
import { PlanQualityError, assertPlanQuality, repairPlan } from "./planQuality";

const EMPTY: FlowGraph = { nodes: [], edges: [] };
const node = (id: string): FlowGraph["nodes"][number] => ({ id, type: "canvasNode", position: { x: 0, y: 0 }, data: { label: id, color: "#000", textColor: "#fff", shape: "rectangle" } });
const graphOf = (...ids: string[]): FlowGraph => ({ nodes: ids.map(node), edges: [] });
const plan = (...operations: DesignOperation[]): DesignPlan => ({ summary: "s", operations });
const addNode = (id: string, label?: string): DesignOperation => ({ type: "add_node", id, label });
const addEdge = (id: string, source: string, target: string): DesignOperation => ({ type: "add_edge", id, source, target });
const types = (p: DesignPlan) => p.operations.map((op) => op.type);

describe("repairPlan", () => {
    it("orders nodes before the edges that use them, even when the model listed edges first", () => {
        const { plan: repaired } = repairPlan(EMPTY, plan(addEdge("e1", "a", "b"), addNode("a"), addNode("b")));
        expect(types(repaired)).toEqual(["add_node", "add_node", "add_edge"]);
    });

    it("drops edges that point at nodes that do not exist, and says why", () => {
        const { plan: repaired, dropped } = repairPlan(EMPTY, plan(addNode("a"), addEdge("e1", "a", "ghost")));
        expect(types(repaired)).toEqual(["add_node"]);
        expect(dropped.join(" ")).toContain("missing node");
    });

    it("snaps an endpoint written as a label to the node it names", () => {
        const labelled = (id: string, label: string): DesignOperation => ({ type: "add_node", id, label });
        const { plan: repaired } = repairPlan(EMPTY, plan(labelled("order-service", "Order Service"), labelled("db", "Orders DB"), addEdge("e1", "Order Service", "orders db")));
        expect(repaired.operations.at(-1)).toMatchObject({ type: "add_edge", source: "order-service", target: "db" });
    });

    it("recovers an endpoint polluted with leaked reasoning, when it clearly starts with a real id", () => {
        const { plan: repaired } = repairPlan(EMPTY, plan(addNode("mobile-app"), addNode("api-server"), addEdge("e1", "mobile-app", "api-server Rhine? No, plain target id api-server! Wait.")));
        expect(repaired.operations.at(-1)).toMatchObject({ source: "mobile-app", target: "api-server" });
    });

    it("does not snap to an id that is merely the start of a longer different id", () => {
        const { plan: repaired, dropped } = repairPlan(EMPTY, plan(addNode("api"), addNode("db"), addEdge("e1", "db", "api-gateway")));
        expect(types(repaired)).toEqual(["add_node", "add_node"]);
        expect(dropped.join(" ")).toContain("missing node");
    });

    it("accepts an edge to an existing node", () => {
        const { plan: repaired } = repairPlan(graphOf("db"), plan(addNode("cache"), addEdge("e1", "cache", "db")));
        expect(types(repaired)).toEqual(["add_node", "add_edge"]);
    });

    it("removes duplicate nodes, duplicate edges and self-loops", () => {
        const { plan: repaired } = repairPlan(EMPTY, plan(addNode("a"), addNode("a"), addNode("b"), addEdge("e1", "a", "b"), addEdge("e2", "a", "b"), addEdge("e3", "a", "a")));
        expect(types(repaired)).toEqual(["add_node", "add_node", "add_edge"]);
    });

    it("gives unlabeled nodes a readable label from their id", () => {
        const { plan: repaired } = repairPlan(EMPTY, plan(addNode("order-service")));
        expect(repaired.operations[0]!.label).toBe("Order Service");
    });

    it("renames an edge whose id collides with an existing one", () => {
        const graph = { ...graphOf("a", "b"), edges: [{ id: "e1", source: "b", target: "a", type: "canvasEdge" }] };
        const { plan: repaired } = repairPlan(graph, plan(addEdge("e1", "a", "b")));
        expect(repaired.operations[0]!.id).toBe("a-b");
    });

    it("ignores edits to unknown nodes and runs deletions last", () => {
        const { plan: repaired, dropped } = repairPlan(graphOf("a", "b"), plan({ type: "delete_node", id: "a" }, { type: "update_node", id: "nope", label: "x" }, { type: "update_node", id: "b", label: "B" }));
        expect(types(repaired)).toEqual(["update_node", "delete_node"]);
        expect(dropped.join(" ")).toContain("unknown node nope");
    });

    it("rejects an edge to a node the same plan deletes", () => {
        const { plan: repaired } = repairPlan(graphOf("a", "b"), plan({ type: "delete_node", id: "b" }, addEdge("e1", "a", "b")));
        expect(types(repaired)).toEqual(["delete_node"]);
    });
});

describe("assertPlanQuality", () => {
    const nodes = (n: number) => Array.from({ length: n }, (_, i) => addNode(`n${i}`));
    const chain = (n: number) => Array.from({ length: n - 1 }, (_, i) => addEdge(`e${i}`, `n${i}`, `n${i + 1}`));

    it("rejects a first design that is syntactically fine but useless: many nodes, almost no edges", () => {
        expect(() => assertPlanQuality(EMPTY, plan(...nodes(11), addEdge("e", "n0", "n1")))).toThrow(PlanQualityError);
    });

    it("rejects a first design with too few components", () => {
        expect(() => assertPlanQuality(EMPTY, plan(...nodes(2), ...chain(2)))).toThrow(/only 2 components/);
    });

    it("accepts a connected first design", () => {
        expect(() => assertPlanQuality(EMPTY, plan(...nodes(10), ...chain(10)))).not.toThrow();
    });

    it("does not hold small edits to the first-design bar", () => {
        expect(() => assertPlanQuality(graphOf("db"), plan(addNode("cache")))).not.toThrow();
    });

    it("accepts a plan with no operations (a question answered in the summary)", () => {
        expect(() => assertPlanQuality(EMPTY, plan())).not.toThrow();
    });

    it("rejects a plan whose every operation was dropped by repair", () => {
        expect(() => assertPlanQuality(graphOf("a"), plan(), 5)).toThrow(/None of the proposed changes/);
    });
});
