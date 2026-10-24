import {
  getNodesBounds,
  getViewportForBounds,
  type Edge,
  type Node,
} from "@xyflow/react";
import { toMermaid, withoutFreeLines, type GraphInput } from "@repo/types";

/*
  Getting a diagram out of the editor: Mermaid text for READMEs and wikis, a PNG for slides, and the raw
  JSON snapshot. Everything works from the nodes and edges React Flow already holds in the browser.
 */
type FlowNodeLike = Node<{
  label?: string;
  shape?: string;
  color?: string;
  textColor?: string;
}>;
type FlowEdgeLike = Edge<{
  label?: string;
  lineStyle?: string;
  startMarker?: string;
  endMarker?: string;
}>;

const sizeOf = (node: FlowNodeLike) => ({
  width: node.measured?.width ?? (Number(node.style?.width) || 140),
  height: node.measured?.height ?? (Number(node.style?.height) || 60),
});

export const toGraphInput = (
  nodes: FlowNodeLike[],
  edges: FlowEdgeLike[],
): GraphInput =>
  withoutFreeLines({
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.data?.label ?? "",
      shape: node.data?.shape,
      color: node.data?.color,
      textColor: node.data?.textColor,
      ...sizeOf(node),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data?.label,
      lineStyle: edge.data?.lineStyle,
      startMarker: edge.data?.startMarker,
      endMarker: edge.data?.endMarker,
    })),
  });

export const mermaidOf = (nodes: FlowNodeLike[], edges: FlowEdgeLike[]) =>
  toMermaid(toGraphInput(nodes, edges));

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const downloadText = (
  text: string,
  fileName: string,
  mime = "text/plain",
) => saveBlob(new Blob([text], { type: `${mime};charset=utf-8` }), fileName);

export const downloadJson = (
  nodes: FlowNodeLike[],
  edges: FlowEdgeLike[],
  fileName: string,
) =>
  downloadText(
    JSON.stringify({ nodes, edges }, null, 2),
    fileName,
    "application/json",
  );

const PNG_PADDING = 0.12;
const PNG_MAX_SIDE = 3200;

/*
  Renders the whole diagram (not just what is on screen) to a PNG: the viewport element is cloned at a
  size that fits every node, following React Flow's own recommended approach. The library is loaded on
  demand, so it costs nothing until someone exports.
 */
export const downloadPng = async (nodes: FlowNodeLike[], fileName: string) => {
  if (nodes.length === 0) throw new Error("There is nothing to export yet.");
  const element = document.querySelector<HTMLElement>(".react-flow__viewport");
  if (!element) throw new Error("The canvas is not ready.");

  const { toPng } = await import("html-to-image");
  const bounds = getNodesBounds(nodes);
  const width = Math.min(
    PNG_MAX_SIDE,
    Math.max(640, Math.round(bounds.width * (1 + PNG_PADDING * 2))),
  );
  const height = Math.min(
    PNG_MAX_SIDE,
    Math.max(400, Math.round(bounds.height * (1 + PNG_PADDING * 2))),
  );
  const viewport = getViewportForBounds(
    bounds,
    width,
    height,
    0.2,
    2,
    PNG_PADDING,
  );

  const dataUrl = await toPng(element, {
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    // The grab dots at the ends of free lines are for editing, not part of the picture.
    filter: (node) =>
      !(node instanceof HTMLElement && node.dataset.exportHide !== undefined),
    width,
    height,
    pixelRatio: 2,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });

  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};
