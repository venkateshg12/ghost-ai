import * as Y from "yjs";
import { z } from "zod";
import { CUSTOM_EDGE_TYPE, CUSTOM_NODE_TYPE, type CanvasEdgeData, type CanvasNodeData } from "./canvas";

export interface DocNode {
    id: string;
    type: string;
    position: { x: number; y: number };
    style?: Record<string, unknown>;
    data: CanvasNodeData;
    [key: string]: unknown;
}

export interface DocEdge {
    id: string;
    type: string;
    source: string;
    target: string;
    label?: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    data?: CanvasEdgeData;
    [key: string]: unknown;
}

export interface DocFlowGraph {
    nodes: DocNode[];
    edges: DocEdge[];
}

export const isYMap = (val: unknown): val is Y.Map<unknown> => {
    return Boolean(
        val &&
            typeof val === "object" &&
            ("_map" in (val as Record<string, unknown>) ||
                (val as Record<string, unknown>).constructor?.name === "YMap" ||
                val instanceof Y.Map)
    );
};

export const getDocNodesMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap<Y.Map<unknown>>("nodes");
export const getDocEdgesMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap<Y.Map<unknown>>("edges");

/** Writes a node into the doc's nodes Y.Map, using a nested Y.Map for `data`. */
export const writeNode = (
    nodesMap: Y.Map<Y.Map<unknown>>,
    node: DocNode,
    // Keep the position already in the document: used when only a node's content changed, so a teammate's
    // concurrent move is not overwritten by this client's stale copy of the position.
    options: { skipPosition?: boolean } = {}
) => {
    let nodeMap = nodesMap.get(node.id);
    if (!nodeMap || !isYMap(nodeMap)) {
        const MapConstructor = ((nodesMap as unknown as { constructor: typeof Y.Map }).constructor || Y.Map);
        nodeMap = new MapConstructor();
        nodesMap.set(node.id, nodeMap);
    }

    nodeMap.set("id", node.id);
    nodeMap.set("type", node.type || CUSTOM_NODE_TYPE);
    if (!options.skipPosition || !nodeMap.has("position")) {
        nodeMap.set("position", { x: Math.round(node.position.x), y: Math.round(node.position.y) });
    }

    if (node.style) {
        nodeMap.set("style", { ...node.style });
    }

    let dataMap = nodeMap.get("data");
    if (!isYMap(dataMap)) {
        const DataMapConstructor = ((nodeMap as unknown as { constructor: typeof Y.Map }).constructor || Y.Map);
        dataMap = new DataMapConstructor();
        nodeMap.set("data", dataMap);
    }
    const targetDataMap = dataMap as Y.Map<unknown>;

    if (node.data) {
        for (const [key, val] of Object.entries(node.data)) {
            if (val !== undefined) {
                targetDataMap.set(key, val);
            } else {
                targetDataMap.delete(key);
            }
        }
    }
};

/** Writes an edge into the doc's edges Y.Map. */
export const writeEdge = (edgesMap: Y.Map<Y.Map<unknown>>, edge: DocEdge) => {
    let edgeMap = edgesMap.get(edge.id);
    if (!edgeMap || !isYMap(edgeMap)) {
        const MapConstructor = ((edgesMap as unknown as { constructor: typeof Y.Map }).constructor || Y.Map);
        edgeMap = new MapConstructor();
        edgesMap.set(edge.id, edgeMap);
    }

    edgeMap.set("id", edge.id);
    edgeMap.set("type", edge.type || CUSTOM_EDGE_TYPE);
    edgeMap.set("source", edge.source);
    edgeMap.set("target", edge.target);
    // Which of a node's four handles the edge uses. Never store undefined/null: Y.Map values must be JSON.
    if (typeof edge.sourceHandle === "string") edgeMap.set("sourceHandle", edge.sourceHandle);
    if (typeof edge.targetHandle === "string") edgeMap.set("targetHandle", edge.targetHandle);

    const label = edge.label ?? (edge.data?.label as string | undefined);
    if (label !== undefined) {
        edgeMap.set("label", label);
    }

    let dataMap = edgeMap.get("data");
    if (!isYMap(dataMap)) {
        const DataMapConstructor = ((edgeMap as unknown as { constructor: typeof Y.Map }).constructor || Y.Map);
        dataMap = new DataMapConstructor();
        edgeMap.set("data", dataMap);
    }
    const targetDataMap = dataMap as Y.Map<unknown>;

    if (edge.data) {
        for (const [key, val] of Object.entries(edge.data)) {
            if (val !== undefined) {
                targetDataMap.set(key, val);
            } else {
                targetDataMap.delete(key);
            }
        }
    } else if (label !== undefined) {
        targetDataMap.set("label", label);
    }
};

/** Quick update of a node's position. */
export const writeNodePosition = (doc: Y.Doc, id: string, pos: { x: number; y: number }) => {
    const nodesMap = getDocNodesMap(doc);
    const nodeMap = nodesMap.get(id);
    if (nodeMap && isYMap(nodeMap)) {
        nodeMap.set("position", { x: Math.round(pos.x), y: Math.round(pos.y) });
    }
};

/** Quick update of a node's data. */
export const writeNodeData = (doc: Y.Doc, id: string, dataPatch: Partial<CanvasNodeData>) => {
    const nodesMap = getDocNodesMap(doc);
    const nodeMap = nodesMap.get(id);
    if (!nodeMap || !isYMap(nodeMap)) return;

    let dataMap = nodeMap.get("data");
    if (!isYMap(dataMap)) {
        const DataMapConstructor = ((nodeMap as unknown as { constructor: typeof Y.Map }).constructor || Y.Map);
        dataMap = new DataMapConstructor();
        nodeMap.set("data", dataMap);
    }
    const targetDataMap = dataMap as Y.Map<unknown>;

    for (const [key, val] of Object.entries(dataPatch)) {
        if (val !== undefined) {
            targetDataMap.set(key, val);
        } else {
            targetDataMap.delete(key);
        }
    }
};

/** Converts a Y.Doc into a plain FlowGraph object. */
export const toFlowGraph = (doc: Y.Doc): DocFlowGraph => {
    const nodesMap = getDocNodesMap(doc);
    const edgesMap = getDocEdgesMap(doc);

    const nodes: DocNode[] = [];
    nodesMap.forEach((nodeMap, id) => {
        if (!nodeMap || !isYMap(nodeMap)) return;
        const pos = (nodeMap.get("position") as { x: number; y: number }) || { x: 0, y: 0 };
        const style = (nodeMap.get("style") as Record<string, unknown>) || undefined;
        const type = (nodeMap.get("type") as string) || CUSTOM_NODE_TYPE;

        const rawData = nodeMap.get("data");
        const data: CanvasNodeData = isYMap(rawData)
            ? (rawData.toJSON() as CanvasNodeData)
            : (rawData as CanvasNodeData) || {
                  label: id,
                  color: "",
                  textColor: "",
                  shape: "rectangle",
              };

        nodes.push({
            id,
            type,
            position: { x: pos.x ?? 0, y: pos.y ?? 0 },
            style,
            data,
        });
    });

    const edges: DocEdge[] = [];
    edgesMap.forEach((edgeMap, id) => {
        if (!edgeMap || !isYMap(edgeMap)) return;
        const source = (edgeMap.get("source") as string) || "";
        const target = (edgeMap.get("target") as string) || "";
        const type = (edgeMap.get("type") as string) || CUSTOM_EDGE_TYPE;
        const label = (edgeMap.get("label") as string) || "";

        const rawData = edgeMap.get("data");
        const data: CanvasEdgeData = isYMap(rawData)
            ? (rawData.toJSON() as CanvasEdgeData)
            : (rawData as CanvasEdgeData) || { label };

        const sourceHandle = edgeMap.get("sourceHandle");
        const targetHandle = edgeMap.get("targetHandle");

        edges.push({
            id,
            type,
            source,
            target,
            ...(typeof sourceHandle === "string" ? { sourceHandle } : {}),
            ...(typeof targetHandle === "string" ? { targetHandle } : {}),
            label: label || (data.label as string | undefined),
            data,
        });
    });

    nodes.sort((a, b) => a.id.localeCompare(b.id));
    edges.sort((a, b) => a.id.localeCompare(b.id));

    return { nodes, edges };
};



/*
  Shape checks for entries a client wrote into the document. A CRDT cannot reject an operation once it is
  merged, so the gateway validates what a transaction touched and quarantines anything that fails.
 */
const MAX_ENTRY_JSON_CHARS = 20_000;
const coordinate = z.number().finite().min(-1e7).max(1e7);
const entryId = z.string().min(1).max(128);

const withinEntrySize = (value: unknown) => JSON.stringify(value).length <= MAX_ENTRY_JSON_CHARS;

export const docNodeSchema = z
    .object({
        id: entryId,
        type: z.string().max(64),
        position: z.object({ x: coordinate, y: coordinate }),
        style: z.record(z.string(), z.unknown()).optional(),
        data: z.record(z.string(), z.unknown()),
    })
    .passthrough()
    .refine(withinEntrySize, { message: "node is too large" });

export const docEdgeSchema = z
    .object({
        id: entryId,
        type: z.string().max(64),
        source: entryId,
        target: entryId,
        label: z.string().max(2_000).optional(),
        sourceHandle: z.string().max(64).optional(),
        targetHandle: z.string().max(64).optional(),
        data: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough()
    .refine(withinEntrySize, { message: "edge is too large" });

/** True when the entry stored under `key` is a well-formed node or edge. A missing entry (a delete) is valid. */
export const isValidDocEntry = (kind: "node" | "edge", key: string, value: unknown): boolean => {
    if (value === undefined) return true;
    if (!isYMap(value)) return false;

    const json = value.toJSON() as Record<string, unknown>;
    if (json.id !== key) return false;
    return (kind === "node" ? docNodeSchema : docEdgeSchema).safeParse(json).success;
};
