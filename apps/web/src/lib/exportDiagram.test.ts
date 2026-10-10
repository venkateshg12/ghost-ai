import { describe, expect, it } from "vitest";
import { mermaidOf, toGraphInput } from "./exportDiagram";

const nodes = [
  { id: "a", position: { x: 0, y: 0 }, style: { width: 160, height: 70 }, data: { label: "Web Client", shape: "pill", color: "#10233D", textColor: "#52A8FF" } },
  { id: "b", position: { x: 300, y: 0 }, measured: { width: 120, height: 50 }, data: { label: "API", shape: "rectangle" } },
];
const edges = [{ id: "e1", source: "a", target: "b", data: { label: "HTTPS" } }];

describe("exportDiagram", () => {
  it("maps React Flow nodes and edges to the shared graph shape, measuring sizes from the DOM or the style", () => {
    const graph = toGraphInput(nodes, edges);
    expect(graph.nodes[0]).toMatchObject({ id: "a", label: "Web Client", shape: "pill", width: 160, height: 70 });
    expect(graph.nodes[1]).toMatchObject({ width: 120, height: 50 });
    expect(graph.edges[0]).toEqual({ id: "e1", source: "a", target: "b", label: "HTTPS" });
  });

  it("produces Mermaid for the current canvas", () => {
    const text = mermaidOf(nodes, edges);
    expect(text).toContain("flowchart LR");
    expect(text).toContain('n1(["Web Client"])');
    expect(text).toContain("n1 -->|HTTPS| n2");
  });
});
