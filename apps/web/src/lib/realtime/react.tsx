"use client";

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ReactNode,
} from "react";
import {
    applyEdgeChanges,
    applyNodeChanges,
    type Connection as FlowConnection,
    type EdgeChange,
    type NodeChange,
} from "@xyflow/react";
import {
    AI_CHAT_FEED,
    CUSTOM_EDGE_TYPE,
    getDocEdgesMap,
    getDocNodesMap,
    writeEdge,
    writeNode,
    writeNodePosition,
    type ChatMessagePayload,
    type DocEdge,
    type DocNode,
    type Presence,
    type ServerPresenceChange,
} from "@repo/types";
import { RoomClient, type RoomStatus } from "./RoomClient";
import { LOCAL_ORIGIN } from "./undo";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/types";

const RealtimeContext = createContext<RoomClient | null>(null);

/*
  The client is created inside the effect, not during render. React Strict Mode mounts, unmounts and remounts
  every effect in development; a client made during render would be torn down by the first cleanup (its document
  is destroyed) and then reused by the second mount, silently sending nothing.
 */
export const RealtimeProvider = ({
    roomId,
    children,
    fallback = null,
}: {
    roomId: string;
    children: ReactNode;
    fallback?: ReactNode;
}) => {
    const [client, setClient] = useState<RoomClient | null>(null);

    useEffect(() => {
        const next = new RoomClient(roomId);
        setClient(next);
        next.connect();
        return () => {
            next.disconnect();
            setClient(null);
        };
    }, [roomId]);

    if (!client) return <>{fallback}</>;

    return <RealtimeContext.Provider value={client}>{children}</RealtimeContext.Provider>;
};

export const useRoomClient = (): RoomClient => {
    const client = useContext(RealtimeContext);
    if (!client) {
        throw new Error("useRoomClient must be used within a RealtimeProvider");
    }
    return client;
};

export const useRoomStatus = (): RoomStatus => {
    const client = useRoomClient();
    return useSyncExternalStore(
        (cb) => client.subscribeStatus(cb),
        () => client.getStatus(),
        () => client.getStatus()
    );
};

export const useOthers = <T = ServerPresenceChange[]>(
    selector?: (others: ServerPresenceChange[]) => T
): T => {
    const client = useRoomClient();
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const cacheRef = useRef<{ version: number; result: T }>({
        version: -1,
        result: undefined as unknown as T,
    });

    const getSnapshot = useCallback(() => {
        const currentVersion = client.presenceVersion;
        if (cacheRef.current.version !== currentVersion) {
            cacheRef.current.version = currentVersion;
            const list = Array.from(client.others.values());
            cacheRef.current.result = selectorRef.current
                ? selectorRef.current(list)
                : (list as unknown as T);
        }
        return cacheRef.current.result;
    }, [client]);

    return useSyncExternalStore(
        (cb) => client.subscribePresence(cb),
        getSnapshot,
        getSnapshot
    );
};

export const useOther = <T = ServerPresenceChange | undefined>(
    connectionId: string,
    selector?: (other: ServerPresenceChange | undefined) => T
): T => {
    const client = useRoomClient();
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const cacheRef = useRef<{ version: number; result: T }>({
        version: -1,
        result: undefined as unknown as T,
    });

    const getSnapshot = useCallback(() => {
        const currentVersion = client.presenceVersion;
        if (cacheRef.current.version !== currentVersion) {
            cacheRef.current.version = currentVersion;
            const item = client.others.get(connectionId);
            cacheRef.current.result = selectorRef.current
                ? selectorRef.current(item)
                : (item as unknown as T);
        }
        return cacheRef.current.result;
    }, [client, connectionId]);

    return useSyncExternalStore(
        (cb) => client.subscribePresence(cb),
        getSnapshot,
        getSnapshot
    );
};

export const useSelf = () => {
    const client = useRoomClient();
    const cacheRef = useRef<{ version: number; result: { presence: Presence; connectionId: string | null } }>({
        version: -1,
        result: { presence: client.selfPresence, connectionId: client.myConnectionId },
    });

    // Same object until something changed, as useSyncExternalStore requires.
    const getSnapshot = useCallback(() => {
        if (cacheRef.current.version !== client.selfVersion) {
            cacheRef.current = {
                version: client.selfVersion,
                result: { presence: client.selfPresence, connectionId: client.myConnectionId },
            };
        }
        return cacheRef.current.result;
    }, [client]);

    return useSyncExternalStore((cb) => client.subscribeSelf(cb), getSnapshot, getSnapshot);
};

export const useUpdateMyPresence = () => {
    const client = useRoomClient();
    return useCallback(
        (patch: Partial<Presence>) => {
            client.updateMyPresence(patch);
        },
        [client]
    );
};

export const useUndo = () => {
    const client = useRoomClient();
    return useCallback(() => client.undoManager.undo(), [client]);
};

export const useRedo = () => {
    const client = useRoomClient();
    return useCallback(() => client.undoManager.redo(), [client]);
};

export const useCanUndo = (): boolean => {
    const client = useRoomClient();
    return useSyncExternalStore(
        (cb) => client.undoManager.subscribe(() => cb()),
        () => client.undoManager.getState().canUndo,
        () => false
    );
};

export const useCanRedo = (): boolean => {
    const client = useRoomClient();
    return useSyncExternalStore(
        (cb) => client.undoManager.subscribe(() => cb()),
        () => client.undoManager.getState().canRedo,
        () => false
    );
};

export const useFeedMessages = (feed: string): { messages: { id: string; data: unknown; createdAt: number }[] } => {
    const client = useRoomClient();
    const cacheRef = useRef<{ version: number; result: { messages: { id: string; data: unknown; createdAt: number }[] } }>({
        version: -1,
        result: { messages: [] },
    });

    const getSnapshot = useCallback(() => {
        const currentVersion = client.feedVersions[feed] ?? 0;
        if (cacheRef.current.version !== currentVersion) {
            cacheRef.current.version = currentVersion;
            const list = client.feeds[feed] || [];
            cacheRef.current.result = {
                messages: list.map((m) => ({
                    id: m.id,
                    data: m.data,
                    createdAt: typeof m.createdAt === "number" ? m.createdAt : new Date(m.createdAt).getTime(),
                })),
            };
        }
        return cacheRef.current.result;
    }, [client, feed]);

    return useSyncExternalStore(
        (cb) => client.subscribeFeed(feed, cb),
        getSnapshot,
        getSnapshot
    );
};

export const useCreateFeedMessage = () => {
    const client = useRoomClient();
    return useCallback(
        (feed: string, data: unknown) => {
            if (feed === AI_CHAT_FEED) {
                client.createChatMessage(data as ChatMessagePayload);
            }
        },
        [client]
    );
};

type DocMaps = { nodesMap: ReturnType<typeof getDocNodesMap>; edgesMap: ReturnType<typeof getDocEdgesMap> };

const sameJson = (a: unknown, b: unknown) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const sameNode = (prev: CanvasFlowNode, next: DocNode) =>
    prev.type === next.type &&
    // While this user drags a node, the local position is ahead of the throttled one in the document.
    (prev.dragging || (prev.position.x === next.position.x && prev.position.y === next.position.y)) &&
    sameJson(prev.style, next.style) &&
    sameJson(prev.data, next.data);

const sameEdge = (prev: CanvasFlowEdge, next: DocEdge) =>
    prev.type === next.type &&
    prev.source === next.source &&
    prev.target === next.target &&
    (prev.sourceHandle ?? null) === (next.sourceHandle ?? null) &&
    (prev.targetHandle ?? null) === (next.targetHandle ?? null) &&
    sameJson(prev.label, next.label) &&
    sameJson(prev.data, next.data);

/*
  Rebuilds React's arrays from the document while keeping the identity of everything that did not change, so
  React Flow does not re-measure and re-render the whole canvas for one teammate's cursor-sized edit. `selected`
  and `dragging` are this user's view state and are never shared.
 */
const mergeNodes = (prev: CanvasFlowNode[], next: DocNode[]): CanvasFlowNode[] => {
    const prevById = new Map(prev.map((n) => [n.id, n]));
    let changed = prev.length !== next.length;

    const merged = next.map((n, index) => {
        const old = prevById.get(n.id);
        if (old && sameNode(old, n)) {
            if (prev[index] !== old) changed = true;
            return old;
        }
        changed = true;
        return {
            ...old, // keeps what React Flow measured
            ...n,
            position: old?.dragging ? old.position : n.position,
            selected: old?.selected ?? false,
            dragging: old?.dragging ?? false,
        } as CanvasFlowNode;
    });

    return changed ? merged : prev;
};

const mergeEdges = (prev: CanvasFlowEdge[], next: DocEdge[]): CanvasFlowEdge[] => {
    const prevById = new Map(prev.map((e) => [e.id, e]));
    let changed = prev.length !== next.length;

    const merged = next.map((e, index) => {
        const old = prevById.get(e.id);
        if (old && sameEdge(old, e)) {
            if (prev[index] !== old) changed = true;
            return old;
        }
        changed = true;
        return { ...old, ...e, selected: old?.selected ?? false } as CanvasFlowEdge;
    });

    return changed ? merged : prev;
};

const removeEdgesOf = (edgesMap: DocMaps["edgesMap"], nodeId: string) => {
    const attached: string[] = [];
    edgesMap.forEach((edge, id) => {
        if (edge.get("source") === nodeId || edge.get("target") === nodeId) attached.push(id);
    });
    for (const id of attached) edgesMap.delete(id);
};

/*
  Makes the document's nodes and edges equal to the given ones without discarding what teammates changed
  meanwhile: entries that are no longer wanted are deleted, the rest are written field by field.
 */
const applyGraph = (
    { nodesMap, edgesMap }: DocMaps,
    nodes: CanvasFlowNode[] | null,
    edges: CanvasFlowEdge[] | null
) => {
    if (nodes) {
        const keep = new Set(nodes.map((n) => n.id));
        for (const key of Array.from(nodesMap.keys())) if (!keep.has(key)) nodesMap.delete(key);
        for (const node of nodes) writeNode(nodesMap, node as unknown as DocNode);
    }
    if (edges) {
        const keep = new Set(edges.map((e) => e.id));
        for (const key of Array.from(edgesMap.keys())) if (!keep.has(key)) edgesMap.delete(key);
        for (const edge of edges) writeEdge(edgesMap, edge as unknown as DocEdge);
    }
};

/**
 * React Flow to Yjs bridge. Local changes apply to React state at once and are written to the document;
 * the document (including other people's edits) flows back into React state, batched to one update per frame.
 */
export const useFlow = () => {
    const client = useRoomClient();
    const [nodes, setNodesState] = useState<CanvasFlowNode[]>([]);
    const [edges, setEdgesState] = useState<CanvasFlowEdge[]>([]);

    const nodesRef = useRef(nodes);
    nodesRef.current = nodes;
    const dragThrottleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

    // Document -> React state
    useEffect(() => {
        let frame: number | undefined;
        const timers = dragThrottleTimers.current;

        const updateFromDoc = () => {
            frame = undefined;
            const snapshot = client.getSnapshot();
            setNodesState((prev) => mergeNodes(prev, snapshot.nodes));
            setEdgesState((prev) => mergeEdges(prev, snapshot.edges));
        };
        const schedule = () => {
            if (frame === undefined) frame = requestAnimationFrame(updateFromDoc);
        };

        updateFromDoc();
        const unsubscribe = client.subscribeDoc(schedule);
        return () => {
            unsubscribe();
            if (frame !== undefined) cancelAnimationFrame(frame);
            for (const timer of timers.values()) clearTimeout(timer);
            timers.clear();
        };
    }, [client]);

    const maps = useCallback(
        (): DocMaps => ({ nodesMap: getDocNodesMap(client.doc), edgesMap: getDocEdgesMap(client.doc) }),
        [client]
    );

    const onNodesChange = useCallback(
        (changes: NodeChange<CanvasFlowNode>[]) => {
            // 1. Local state first, so a drag follows the pointer without waiting on anything.
            setNodesState((nds) => applyNodeChanges(changes, nds));

            // 2. The document. One transaction per batch, tagged so only this user's undo sees it.
            const { nodesMap, edgesMap } = maps();
            client.doc.transact(() => {
                for (const change of changes) {
                    if (change.type === "remove") {
                        // A node never outlives its edges: both go in the same transaction.
                        nodesMap.delete(change.id);
                        removeEdgesOf(edgesMap, change.id);
                    } else if (change.type === "add") {
                        writeNode(nodesMap, change.item as unknown as DocNode);
                    } else if (change.type === "position" && change.position) {
                        const id = change.id;

                        if (change.dragging === false) {
                            // Drag stop: always write the final position.
                            clearTimeout(dragThrottleTimers.current.get(id));
                            dragThrottleTimers.current.delete(id);
                            writeNodePosition(client.doc, id, change.position);
                        } else if (!dragThrottleTimers.current.has(id)) {
                            // During a drag, at most one write per 50 ms.
                            writeNodePosition(client.doc, id, change.position);
                            dragThrottleTimers.current.set(
                                id,
                                setTimeout(() => dragThrottleTimers.current.delete(id), 50)
                            );
                        }
                    } else if (change.type === "replace") {
                        // Content edits (label, colour) leave the position alone unless this replace really moved
                        // the node, so a teammate's concurrent move is kept.
                        const before = nodesRef.current.find((n) => n.id === change.id);
                        const moved =
                            !before ||
                            before.position.x !== change.item.position.x ||
                            before.position.y !== change.item.position.y;
                        writeNode(nodesMap, change.item as unknown as DocNode, { skipPosition: !moved });
                    } else if (change.type === "dimensions" && change.dimensions) {
                        // Only a resize the user made is shared. Plain measurements are every client's own business
                        // and would otherwise write every node on load.
                        if (!change.setAttributes && change.resizing === undefined) continue;

                        const nodeMap = nodesMap.get(change.id);
                        if (!nodeMap) continue;
                        const style = (nodeMap.get("style") as Record<string, unknown> | undefined) ?? {};
                        if (style.width === change.dimensions.width && style.height === change.dimensions.height) continue;
                        nodeMap.set("style", { ...style, width: change.dimensions.width, height: change.dimensions.height });
                    }
                }
            }, LOCAL_ORIGIN);
        },
        [client, maps]
    );

    const onEdgesChange = useCallback(
        (changes: EdgeChange<CanvasFlowEdge>[]) => {
            setEdgesState((eds) => applyEdgeChanges(changes, eds));

            const { edgesMap } = maps();
            client.doc.transact(() => {
                for (const change of changes) {
                    if (change.type === "remove") edgesMap.delete(change.id);
                    else if (change.type === "add") writeEdge(edgesMap, change.item as unknown as DocEdge);
                    else if (change.type === "replace") writeEdge(edgesMap, change.item as unknown as DocEdge);
                }
            }, LOCAL_ORIGIN);
        },
        [client, maps]
    );

    const onConnect = useCallback(
        (connection: FlowConnection) => {
            if (!connection.source || !connection.target) return;

            const newEdge: CanvasFlowEdge = {
                id: `e_${connection.source}_${connection.target}_${Date.now().toString(36)}`,
                source: connection.source,
                target: connection.target,
                // Which of the node's four handles the edge was drawn from and to.
                sourceHandle: connection.sourceHandle,
                targetHandle: connection.targetHandle,
                type: CUSTOM_EDGE_TYPE,
                data: { label: "" },
            };

            const { edgesMap } = maps();
            client.doc.transact(() => writeEdge(edgesMap, newEdge as unknown as DocEdge), LOCAL_ORIGIN);
        },
        [client, maps]
    );

    const onDelete = useCallback(
        ({ nodes: nodesToDelete, edges: edgesToDelete }: { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] }) => {
            const { nodesMap, edgesMap } = maps();
            client.doc.transact(() => {
                for (const edge of edgesToDelete) edgesMap.delete(edge.id);
                for (const node of nodesToDelete) {
                    nodesMap.delete(node.id);
                    removeEdgesOf(edgesMap, node.id);
                }
            }, LOCAL_ORIGIN);
        },
        [client, maps]
    );

    const setNodes = useCallback(
        (action: CanvasFlowNode[] | ((prev: CanvasFlowNode[]) => CanvasFlowNode[])) => {
            const current = client.getSnapshot().nodes as unknown as CanvasFlowNode[];
            const resolved = typeof action === "function" ? action(current) : action;
            client.doc.transact(() => applyGraph(maps(), resolved, null), LOCAL_ORIGIN);
        },
        [client, maps]
    );

    const setEdges = useCallback(
        (action: CanvasFlowEdge[] | ((prev: CanvasFlowEdge[]) => CanvasFlowEdge[])) => {
            const current = client.getSnapshot().edges as unknown as CanvasFlowEdge[];
            const resolved = typeof action === "function" ? action(current) : action;
            client.doc.transact(() => applyGraph(maps(), null, resolved), LOCAL_ORIGIN);
        },
        [client, maps]
    );

    /** Replaces the whole canvas (a template import) as ONE transaction, so it is one undo step. */
    const replaceGraph = useCallback(
        (nextNodes: CanvasFlowNode[], nextEdges: CanvasFlowEdge[]) => {
            client.doc.transact(() => applyGraph(maps(), nextNodes, nextEdges), LOCAL_ORIGIN);
        },
        [client, maps]
    );

    return {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        onDelete,
        setNodes,
        setEdges,
        replaceGraph,
    };
};
