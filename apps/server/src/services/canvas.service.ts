import type { CanvasSnapshot } from "@repo/types";
import { canvasSnapshotSchema } from "@repo/types";
import { readText } from "../utils/storage";
import { assertProjectAccess } from "./project.service";

const EMPTY_CANVAS: CanvasSnapshot = { nodes: [], edges: [] };

/*
  The live canvas is the realtime room. This is the JSON copy the room's server writes after every save: what the
  spec generator and export read. The browser never writes it; the room does.
 */
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
