import type { CanvasSnapshot } from "@repo/types";
import { canvasSnapshotSchema } from "@repo/types";
import { orm } from "../prisma/db";
import { putText, readText, storagePaths } from "../utils/storage";
import { assertProjectAccess } from "./project.service";

const EMPTY_CANVAS: CanvasSnapshot = { nodes: [], edges: [] };

/*
  The live canvas is the Liveblocks room; this snapshot is the durable copy that seeds an empty room
  (e.g. after the room expires). Every save overwrites one object per project, and Postgres keeps
  only its reference.
 */
export const saveCanvasService = async (projectId: string, userId: string, snapshot: CanvasSnapshot) => {
    await assertProjectAccess(projectId, userId);

    const reference = await putText(
        storagePaths.canvas(projectId),
        JSON.stringify(snapshot),
        "application/json"
    );

    const savedAt = new Date().toISOString();
    await orm.Project
        .where({ id: projectId })
        .update({ canvasJsonPath: reference, updatedAt: savedAt });

    return { savedAt };
};

export const loadCanvasService = async (projectId: string, userId: string): Promise<CanvasSnapshot> => {
    const { project } = await assertProjectAccess(projectId, userId);
    if (!project.canvasJsonPath) return EMPTY_CANVAS;

    const content = await readText(project.canvasJsonPath);
    if (!content) return EMPTY_CANVAS;

    // A snapshot that no longer parses is treated as no snapshot, not as a server error.
    try {
        const parsed = canvasSnapshotSchema.safeParse(JSON.parse(content));
        return parsed.success ? parsed.data : EMPTY_CANVAS;
    } catch {
        return EMPTY_CANVAS;
    }
};
