import { projectIdSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { OK } from "../constants/http";
import { ok } from "../utils/api/apiEnvelope";
import { loadCanvasService } from "../services/canvas.service";

export const getCanvasHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const canvas = await loadCanvasService(projectId, req.userId);
    return res.status(OK).json(ok(canvas));
});
