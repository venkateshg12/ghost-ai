import type { Edge, Node } from "@xyflow/react";
import type { CanvasEdgeData, CanvasNodeData, CUSTOM_EDGE_TYPE, CUSTOM_NODE_TYPE } from "@repo/types";

// React Flow node/edge types for this canvas. The same shapes the server's AI jobs write.
export type CanvasFlowNode = Node<CanvasNodeData, typeof CUSTOM_NODE_TYPE>;
export type CanvasFlowEdge = Edge<CanvasEdgeData, typeof CUSTOM_EDGE_TYPE>;
