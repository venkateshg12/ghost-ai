import { describe, expect, it } from "vitest";
import { layoutGraph } from "./graphLayout";

const box = (id: string, width = 140, height = 60) => ({ id, width, height });

describe("layoutGraph", () => {
    it("returns nothing for an empty graph", () => {
        expect(layoutGraph([], []).size).toBe(0);
    });

    it("places a chain left to right with room for the node widths", () => {
        const p = layoutGraph([box("a"), box("b"), box("c")], [{ source: "a", target: "b" }, { source: "b", target: "c" }]);
        expect(p.get("a")!.x + 140).toBeLessThan(p.get("b")!.x);
        expect(p.get("b")!.x + 140).toBeLessThan(p.get("c")!.x);
    });

    it("never overlaps nodes in a dense graph", () => {
        const nodes = Array.from({ length: 20 }, (_, i) => box(`n${i}`, 100 + (i % 3) * 40, 50 + (i % 4) * 20));
        const edges = Array.from({ length: 19 }, (_, i) => ({ source: `n${i}`, target: `n${(i * 7 + 3) % 20}` }));
        const p = layoutGraph(nodes, edges);
        for (let i = 0; i < nodes.length; i++)
            for (let j = i + 1; j < nodes.length; j++) {
                const a = { ...p.get(nodes[i]!.id)!, w: nodes[i]!.width, h: nodes[i]!.height };
                const b = { ...p.get(nodes[j]!.id)!, w: nodes[j]!.width, h: nodes[j]!.height };
                expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
            }
    });

    it("copes with cycles and with edges to unknown nodes", () => {
        expect(() => layoutGraph([box("a"), box("b")], [{ source: "a", target: "b" }, { source: "b", target: "a" }, { source: "a", target: "ghost" }])).not.toThrow();
    });

    it("starts at the requested origin and supports top-to-bottom", () => {
        const p = layoutGraph([box("a"), box("b")], [{ source: "a", target: "b" }], { originX: 300, originY: 200, direction: "TB" });
        expect(p.get("a")!.x).toBeGreaterThanOrEqual(300 - 1);
        expect(p.get("a")!.y).toBeLessThan(p.get("b")!.y);
    });
});
