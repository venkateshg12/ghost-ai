import { describe, expect, it } from "vitest";
import type { DesignOperation } from "./design";
import { nodeSizeFor, placeNewNodes } from "./placement";
import type { FlowGraph } from "./graph";

const add = (id: string, shape?: DesignOperation["shape"]): DesignOperation => ({ type: "add_node", id, label: id, shape });
const edge = (id: string, source: string, target: string): DesignOperation => ({ type: "add_edge", id, source, target });

const overlaps = (positions: Map<string, { x: number; y: number }>, ops: DesignOperation[]) => {
    const boxes = ops.filter((op) => op.type === "add_node").map((op) => ({ ...positions.get(op.id)!, ...nodeSizeFor(op) }));
    let count = 0;
    for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!, b = boxes[j]!;
            if (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height) count++;
        }
    return count;
};

describe("placeNewNodes", () => {
    it("lays out a first design without overlapping any nodes, whatever their shapes", () => {
        const ops = [add("web", "pill"), add("api", "hexagon"), add("svc"), add("svc2"), add("db", "cylinder"), add("cache", "cylinder"), edge("e1", "web", "api"), edge("e2", "api", "svc"), edge("e3", "api", "svc2"), edge("e4", "svc", "db"), edge("e5", "svc2", "cache")];
        const positions = placeNewNodes({ nodes: [], edges: [] }, ops);
        expect(positions.size).toBe(6);
        expect(overlaps(positions, ops)).toBe(0);
    });

    it("flows left to right along the edges", () => {
        const ops = [add("a"), add("b"), add("c"), edge("e1", "a", "b"), edge("e2", "b", "c")];
        const p = placeNewNodes({ nodes: [], edges: [] }, ops);
        expect(p.get("a")!.x).toBeLessThan(p.get("b")!.x);
        expect(p.get("b")!.x).toBeLessThan(p.get("c")!.x);
    });

    it("puts new nodes to the right of existing work, so nothing already drawn is covered", () => {
        const existing: FlowGraph = { nodes: [{ id: "old", type: "canvasNode", position: { x: 100, y: 50 }, style: { width: 160, height: 70 }, data: { label: "old", color: "", textColor: "", shape: "rectangle" } }], edges: [] };
        const p = placeNewNodes(existing, [add("new")]);
        expect(p.get("new")!.x).toBeGreaterThanOrEqual(100 + 160);
    });

    it("ignores nodes the canvas already has", () => {
        const existing: FlowGraph = { nodes: [{ id: "a", type: "canvasNode", position: { x: 0, y: 0 }, data: { label: "a", color: "", textColor: "", shape: "rectangle" } }], edges: [] };
        expect(placeNewNodes(existing, [add("a")]).size).toBe(0);
    });

    it("clamps absurd sizes from the model", () => {
        expect(nodeSizeFor({ width: 99999, height: 1 })).toEqual({ width: 480, height: 40 });
    });
});
