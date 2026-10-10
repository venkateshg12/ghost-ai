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
});
