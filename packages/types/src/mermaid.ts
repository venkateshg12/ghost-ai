import { validEdges, type GraphInput, type GraphNodeInput } from "./graph";

/*
  Mermaid flowchart text for a diagram, so a design can be pasted into a README, a wiki or any
  Mermaid viewer. Ids are renamed (n1, n2…): Mermaid ids are restrictive and reserved words such as
  "end" break a chart, while labels are quoted and escaped so any text survives.
 */
const escapeLabel = (text: string) =>
    text
        .replace(/\s+/g, " ")
        .trim()
        .replace(/"/g, "#quot;")
        .replace(/[<>]/g, (char) => (char === "<" ? "#lt;" : "#gt;"));

const escapeEdgeLabel = (text: string) => escapeLabel(text).replace(/\|/g, "#124;");

const nodeSyntax = (id: string, node: GraphNodeInput) => {
    const label = escapeLabel(node.label || node.id) || " ";
    switch (node.shape) {
        case "pill":
            return `${id}(["${label}"])`;
        case "circle":
            return `${id}(("${label}"))`;
        case "diamond":
            return `${id}{"${label}"}`;
        case "cylinder":
            return `${id}[("${label}")]`;
        case "hexagon":
            return `${id}{{"${label}"}}`;
        default:
            return `${id}["${label}"]`;
    }
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export const toMermaid = (graph: GraphInput, direction: "LR" | "TB" = "LR"): string => {
    const ids = new Map(graph.nodes.map((node, index) => [node.id, `n${index + 1}`]));
    const lines = [`flowchart ${direction}`];

    for (const node of graph.nodes) lines.push(`    ${nodeSyntax(ids.get(node.id)!, node)}`);

    for (const edge of validEdges(graph)) {
        const label = edge.label?.trim();
        lines.push(`    ${ids.get(edge.source)} -->${label ? `|${escapeEdgeLabel(label)}|` : ""} ${ids.get(edge.target)}`);
    }

    // Keep the canvas colours when they are plain hex values; anything else is ignored rather than injected.
    for (const node of graph.nodes) {
        if (node.color && node.textColor && HEX.test(node.color) && HEX.test(node.textColor)) {
            lines.push(`    style ${ids.get(node.id)} fill:${node.color},stroke:${node.textColor},color:${node.textColor}`);
        }
    }
    return lines.join("\n") + "\n";
};
