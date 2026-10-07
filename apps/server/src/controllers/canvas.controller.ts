import { canvasSnapshotSchema, projectIdSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { OK } from "../constants/http";
import { ok } from "../utils/api/apiEnvelope";
import { loadCanvasService, saveCanvasService } from "../services/canvas.service";

export const getCanvasHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const canvas = await loadCanvasService(projectId, req.userId);
    return res.status(OK).json(ok(canvas));
});

export const saveCanvasHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const snapshot = canvasSnapshotSchema.parse(req.body);
    const result = await saveCanvasService(projectId, req.userId, snapshot);
    return res.status(OK).json(ok(result));
});
