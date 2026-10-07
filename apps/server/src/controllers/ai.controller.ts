import { designRequestSchema, runIdSchema, specRequestSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { ACCEPTED, OK } from "../constants/http";
import { ok } from "../utils/api/apiEnvelope";
import { createRunTokenService, startDesignRunService, startSpecRunService } from "../services/ai.service";

// 202: the work is queued, not done. Progress arrives through `useRealtimeRun` and the room's status feed.
export const startDesignHandler = catchError(async (req, res) => {
    const data = designRequestSchema.parse(req.body);
    const run = await startDesignRunService(req.userId, data);
    return res.status(ACCEPTED).json(ok(run));
});

export const startSpecHandler = catchError(async (req, res) => {
    const data = specRequestSchema.parse(req.body);
    const run = await startSpecRunService(req.userId, data);
    return res.status(ACCEPTED).json(ok(run));
});

export const createRunTokenHandler = catchError(async (req, res) => {
    const runId = runIdSchema.parse(req.params.runId);
    const token = await createRunTokenService(req.userId, runId);
    return res.status(OK).json(ok(token));
});
