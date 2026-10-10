import { IMAGE_MAX_BYTES, applyFixRequestSchema, designRequestSchema, imageDesignQuerySchema, projectIdSchema, reviewRequestSchema, runIdSchema, specRequestSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { ACCEPTED, BAD_REQUEST, OK, PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE } from "../constants/http";
import appAssert from "../utils/errors/appAssert";
import { detectImageType } from "../utils/image";
import { ok } from "../utils/api/apiEnvelope";
import {
    applyFixService,
    cancelRunService,
    createRunTokenService,
    getUsageService,
    revertRunService,
    startDesignRunService,
    startImageDesignRunService,
    startReviewRunService,
    startSpecRunService,
} from "../services/ai.service";

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

export const cancelRunHandler = catchError(async (req, res) => {
    const runId = runIdSchema.parse(req.params.runId);
    return res.status(OK).json(ok(await cancelRunService(req.userId, runId)));
});

export const revertRunHandler = catchError(async (req, res) => {
    const runId = runIdSchema.parse(req.params.runId);
    return res.status(OK).json(ok(await revertRunService(req.userId, runId)));
});

export const getUsageHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    return res.status(OK).json(ok(await getUsageService(req.userId, projectId)));
});

export const startReviewHandler = catchError(async (req, res) => {
    const data = reviewRequestSchema.parse(req.body);
    const run = await startReviewRunService(req.userId, data);
    return res.status(ACCEPTED).json(ok(run));
});

export const applyFixHandler = catchError(async (req, res) => {
    const data = applyFixRequestSchema.parse(req.body);
    return res.status(OK).json(ok(await applyFixService(req.userId, data)));
});

// The request body is the image itself (see the route); roomId and prompt travel in the query string.
export const startImageDesignHandler = catchError(async (req, res) => {
    const query = imageDesignQuerySchema.parse(req.query);

    const body: unknown = req.body;
    appAssert(Buffer.isBuffer(body) && body.length > 0, UNSUPPORTED_MEDIA_TYPE, "Send a PNG, JPEG or WebP image as the request body");
    appAssert(body.length <= IMAGE_MAX_BYTES, PAYLOAD_TOO_LARGE, "That image is larger than 4 MB");

    // The declared type was only used to accept the body; the bytes decide what it really is.
    const mediaType = detectImageType(body);
    appAssert(mediaType, BAD_REQUEST, "That file is not a PNG, JPEG or WebP image");

    const run = await startImageDesignRunService(req.userId, query, { bytes: body, mediaType });
    return res.status(ACCEPTED).json(ok(run));
});
