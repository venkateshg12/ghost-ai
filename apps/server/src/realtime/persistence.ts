import * as Y from "yjs";
import {
    canvasSnapshotSchema,
    getDocEdgesMap,
    getDocNodesMap,
    toFlowGraph,
    writeEdge,
    writeNode,
    type DocEdge,
    type DocNode,
} from "@repo/types";
import { orm } from "../prisma/db";
import { putBytes, putText, readBytes, readText, referenceFor, storagePaths } from "../utils/storage";
import { rtLog } from "./log";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Concurrent first joins of a cold room share one load.
const inFlightLoads = new Map<string, Promise<Y.Doc>>();

/*
  The seeding path for a project that predates the engine: its canvas lives only as a JSON snapshot that the
  Project row points at. Returns null when there is no snapshot, and throws when one exists but can't be read.
 */
const readSnapshot = async (projectId: string) => {
    if (!UUID.test(projectId)) return null;

    const project = await orm.Project.where({ id: projectId }).select("canvasJsonPath").first();
    if (!project?.canvasJsonPath) return null;

    const raw = await readText(project.canvasJsonPath);
    if (!raw) return null;

    try {
        const parsed = canvasSnapshotSchema.safeParse(JSON.parse(raw));
        return parsed.success ? { snapshot: parsed.data, path: project.canvasJsonPath } : null;
    } catch {
        // A snapshot that no longer parses is treated as no snapshot, as the canvas route does.
        return null;
    }
};

/*
  Rooms load from the compacted `.ydoc` when one exists, otherwise from the JSON snapshot. A *failure* to read
  either must not fall through to the next source or to an empty document: the room would then be saved over the
  real data. So read errors propagate and the join fails; the client retries.
 */
export const loadRoomDoc = async (projectId: string): Promise<Y.Doc> => {
    const existing = inFlightLoads.get(projectId);
    if (existing) return existing;

    const promise = (async () => {
        const doc = new Y.Doc();

        const bytes = await readBytes(referenceFor(storagePaths.roomDoc(projectId)));
        if (bytes && bytes.byteLength > 0) {
            Y.applyUpdate(doc, new Uint8Array(bytes));
            return doc;
        }

        const seed = await readSnapshot(projectId);
        if (seed) {
            const nodesMap = getDocNodesMap(doc);
            const edgesMap = getDocEdgesMap(doc);
            doc.transact(() => {
                for (const n of seed.snapshot.nodes) writeNode(nodesMap, n as DocNode);
                for (const e of seed.snapshot.edges) writeEdge(edgesMap, e as DocEdge);
            }, "seed");
            rtLog("room.seeded", { roomId: projectId, nodes: seed.snapshot.nodes.length, edges: seed.snapshot.edges.length });
        }

        return doc;
    })();

    inFlightLoads.set(projectId, promise);
    try {
        return await promise;
    } finally {
        inFlightLoads.delete(projectId);
    }
};

export const saveRoomDoc = async (projectId: string, doc: Y.Doc): Promise<{ savedAt: number }> => {
    // 1. The compacted state: the source of truth the room loads from.
    await putBytes(storagePaths.roomDoc(projectId), Buffer.from(Y.encodeStateAsUpdate(doc)), "application/octet-stream");

    // 2. A JSON copy for what reads the canvas without Yjs: the spec generator, export and GET /projects/:id/canvas.
    //    The Project row keeps the reference putText returns, which is what readText accepts back.
    const reference = await putText(storagePaths.canvas(projectId), JSON.stringify(toFlowGraph(doc)), "application/json");

    const savedAt = Date.now();
    try {
        await orm.Project.where({ id: projectId }).update({
            canvasJsonPath: reference,
            updatedAt: new Date(savedAt).toISOString(),
        });
    } catch (err) {
        // The blobs are written; a stale pointer is repaired by the next save.
        console.warn(`[persistence:${projectId}] updating canvasJsonPath failed:`, err);
    }

    return { savedAt };
};
