import { validEdges, withoutFreeLines, type GraphInput, type GraphNodeInput } from "./graph";

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
        case "parallelogram":
            return `${id}[/"${label}"/]`;
        case "triangle":
            return `${id}>"${label}"]`;
        case "cloud":
        case "star":
            return `${id}("${label}")`;
        case "document":
            return `${id}[["${label}"]]`;
        default:
            return `${id}["${label}"]`;
    }
};

// The Mermaid link for a styled edge. An unstyled edge stays "-->" so existing output doesn't change.
const markerHead = (marker: string | undefined, arrow: string) => {
    if (!marker || marker === "none") return "";
    return marker === "circle" || marker === "circle-outline" ? "o" : arrow;
};

const linkOf = (edge: { lineStyle?: string; startMarker?: string; endMarker?: string }) => {
    const start = markerHead(edge.startMarker, "<");
    const endMarker = edge.endMarker ?? "triangle";
    const end = markerHead(endMarker, ">");
    // Mermaid has only solid and dashed lines; a dotted line is exported as dashed.
    const body = edge.lineStyle === "dashed" || edge.lineStyle === "dotted" ? "-.-" : end ? "--" : "---";
    return `${start}${body}${end}`;
};

const HEX = /^#[0-9a-fA-F]{3,8}$/;

export const toMermaid = (input: GraphInput, direction: "LR" | "TB" = "LR"): string => {
    const graph = withoutFreeLines(input);
    const ids = new Map(graph.nodes.map((node, index) => [node.id, `n${index + 1}`]));
    const lines = [`flowchart ${direction}`];

    for (const node of graph.nodes) lines.push(`    ${nodeSyntax(ids.get(node.id)!, node)}`);

    for (const edge of validEdges(graph)) {
        const label = edge.label?.trim();
        lines.push(`    ${ids.get(edge.source)} ${linkOf(edge)}${label ? `|${escapeEdgeLabel(label)}|` : ""} ${ids.get(edge.target)}`);
    }

    // Keep the canvas colours when they are plain hex values; anything else is ignored rather than injected.
    for (const node of graph.nodes) {
        if (node.color && node.textColor && HEX.test(node.color) && HEX.test(node.textColor)) {
            lines.push(`    style ${ids.get(node.id)} fill:${node.color},stroke:${node.textColor},color:${node.textColor}`);
        }
    }
    return lines.join("\n") + "\n";
};
