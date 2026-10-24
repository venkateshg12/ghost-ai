import { describe, expect, it } from "vitest";
import { toMermaid } from "./mermaid";

describe("toMermaid", () => {
    const graph = {
        nodes: [
            { id: "web-client", label: "Web Client", shape: "pill", color: "#10233D", textColor: "#52A8FF" },
            { id: "end", label: "End", shape: "diamond" },
            { id: "db", label: 'Orders "DB"', shape: "cylinder" },
            { id: "x", label: "Hex", shape: "hexagon" },
            { id: "c", label: "Event", shape: "circle" },
        ],
        edges: [
            { source: "web-client", target: "end", label: "HTTPS" },
            { source: "end", target: "db", label: "a|b" },
            { source: "db", target: "x" },
            { source: "x", target: "ghost" },
        ],
    };
    const out = toMermaid(graph);

    it("starts a left-to-right flowchart", () => {
        expect(out.startsWith("flowchart LR\n")).toBe(true);
        expect(toMermaid(graph, "TB").startsWith("flowchart TB\n")).toBe(true);
    });

    it("renames ids, so reserved words like 'end' cannot break the chart", () => {
        expect(out).not.toMatch(/^\s+end[\s[({]/m);
        expect(out).toContain('n1(["Web Client"])');
    });

    it("uses the right Mermaid syntax for each shape", () => {
        expect(out).toContain('n2{"End"}');
        expect(out).toContain('n3[("Orders #quot;DB#quot;")]');
        expect(out).toContain('n4{{"Hex"}}');
        expect(out).toContain('n5(("Event"))');
    });

    it("escapes quotes and pipes so labels cannot break the syntax", () => {
        expect(out).toContain("-->|a#124;b|");
        expect(out).toContain("-->|HTTPS|");
    });

    it("skips edges to nodes that do not exist", () => {
        expect(out).not.toContain("ghost");
        expect(out.match(/-->/g)).toHaveLength(3);
    });

    it("keeps canvas colours only when they are plain hex", () => {
        expect(out).toContain("style n1 fill:#10233D,stroke:#52A8FF,color:#52A8FF");
        const hostile = toMermaid({ nodes: [{ id: "a", label: "A", color: "red;click a call evil()", textColor: "#fff" }], edges: [] });
        expect(hostile).not.toContain("style");
    });
    it("uses Mermaid syntax for the extra shapes", () => {
        const shapes = toMermaid({
            nodes: [
                { id: "a", label: "IO", shape: "parallelogram" },
                { id: "b", label: "Up", shape: "triangle" },
                { id: "c", label: "Net", shape: "cloud" },
                { id: "d", label: "Doc", shape: "document" },
            ],
            edges: [],
        });
        expect(shapes).toContain('n1[/"IO"/]');
        expect(shapes).toContain('n2>"Up"]');
        expect(shapes).toContain('n3("Net")');
        expect(shapes).toContain('n4[["Doc"]]');
    });

    it("reflects line style and arrowheads, and leaves plain edges as -->", () => {
        const nodes = [{ id: "a", label: "A" }, { id: "b", label: "B" }];
        const link = (edge: object) => toMermaid({ nodes, edges: [{ source: "a", target: "b", ...edge }] });
        expect(link({})).toContain("n1 --> n2");
        expect(link({ endMarker: "none" })).toContain("n1 --- n2");
        expect(link({ startMarker: "arrow", endMarker: "arrow" })).toContain("n1 <--> n2");
        expect(link({ lineStyle: "dashed" })).toContain("n1 -.-> n2");
        expect(link({ lineStyle: "dotted", endMarker: "none" })).toContain("n1 -.- n2");
        expect(link({ endMarker: "circle" })).toContain("n1 --o n2");
    });

    it("leaves free-standing lines out", () => {
        const out = toMermaid({
            nodes: [{ id: "a", label: "A" }, { id: "p1", label: "", shape: "point" }, { id: "p2", label: "", shape: "point" }],
            edges: [{ source: "p1", target: "p2" }],
        });
        expect(out).not.toContain("-->");
        expect(out.match(/\["/g)).toHaveLength(1);
    });
});
