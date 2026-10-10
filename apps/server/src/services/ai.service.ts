import crypto from "node:crypto";
import { auth, runs, tasks } from "@trigger.dev/sdk";
import type {
    AiRunKind,
    AiRunStarted,
    AiRunToken,
    AiUsageSummary,
    ApplyFixRequestSchema,
    DesignRequestSchema,
    ImageDesignQuery,
    ImageType,
    ReviewRequestSchema,
    SpecRequestSchema,
} from "@repo/types";
import { orm } from "../prisma/db";
import appAssert from "../utils/errors/appAssert";
import { BAD_REQUEST, CONFLICT, FORBIDDEN, INTERNAL_SERVER_ERROR, NOT_FOUND } from "../constants/http";
import { appErrorCode } from "../constants/appErrorCode";
import { findReview, markRecommendationApplied, markRunReverted, publishAssistantMessage, publishStatus } from "../utils/liveblocks";
import { applyPlan, getVisionChain, loadSnapshot, placeNewNodes, readFlow, recordRunResult, repairPlan, restoreGraph, saveSnapshot } from "../utils/ai";
import { assertProjectAccess } from "./project.service";
import type { chatAgentTask } from "../trigger/chat-agent";
import type { designAgentTask } from "../trigger/design-agent";
import type { generateSpecTask } from "../trigger/generate-spec";
import type { imageAgentTask } from "../trigger/image-agent";
import type { reviewAgentTask } from "../trigger/review-agent";
import { EXTENSION } from "../utils/image";
import { putBytes, removeObject, storagePaths } from "../utils/storage";

// Tokens re-issued by createRunTokenService; the browser asks for a fresh one if a page outlives the first.
const RUN_TOKEN_EXPIRY = "1h";

// Enough of the prompt to recognise a run in the usage list; the full text lives in the chat feed.
const STORED_PROMPT_CHARS = 500;

/*
  Request handlers never run model calls: they check access, trigger the Trigger.dev task, record who
  started it, and hand back the run id plus a token that can read only that run. The TaskRun row is
  what later lets only that user get a new token for the run.
 */
const recordRun = (runId: string, kind: AiRunKind, projectId: string, userId: string, prompt?: string) =>
    orm.TaskRun.create({ runId, kind, projectId, userId, ...(prompt ? { prompt: prompt.slice(0, STORED_PROMPT_CHARS) } : {}) });

const tagsFor = (projectId: string, userId: string) => [`project_${projectId}`, `user_${userId}`];

/*
  One entry point for both modes. Build edits the canvas (design-agent); Ask answers questions about it
  without touching it (chat-agent). Both read the graph and the conversation from the room.
 */
export const startDesignRunService = async (userId: string, data: DesignRequestSchema): Promise<AiRunStarted> => {
    const { project } = await assertProjectAccess(data.roomId, userId);
    const payload = { projectId: project.id, userId, prompt: data.prompt, focusNodeIds: data.focusNodeIds };

    // Type-only import of the task: the API process never loads task code, only triggers it by id.
    const isAsk = data.mode === "ask";
    const handle = isAsk
        ? await tasks.trigger<typeof chatAgentTask>("chat-agent", payload, { tags: tagsFor(project.id, userId) })
        : await tasks.trigger<typeof designAgentTask>("design-agent", payload, { tags: tagsFor(project.id, userId) });
    const kind: AiRunKind = isAsk ? "chat" : "design";

    await recordRun(handle.id, kind, project.id, userId, data.prompt);
    await publishStatus(project.id, {
        kind,
        runId: handle.id,
        step: "queued",
        text: "Ghost AI is getting ready…",
    });

    return { runId: handle.id, kind, publicAccessToken: handle.publicAccessToken };
};

export const startSpecRunService = async (userId: string, data: SpecRequestSchema): Promise<AiRunStarted> => {
    // The project comes from the room the caller can access — never from a client-supplied id.
    const { project } = await assertProjectAccess(data.roomId, userId);

    const handle = await tasks.trigger<typeof generateSpecTask>(
        "generate-spec",
        { projectId: project.id, userId, chatHistory: data.chatHistory },
        { tags: tagsFor(project.id, userId) }
    );

    await recordRun(handle.id, "spec", project.id, userId);
    await publishStatus(project.id, { kind: "spec", runId: handle.id, step: "queued", text: "Queued technical spec generation…" });

    return { runId: handle.id, kind: "spec", publicAccessToken: handle.publicAccessToken };
};

/** A fresh read-only token for a run, issued only to the user who started it. */
export const createRunTokenService = async (userId: string, runId: string): Promise<AiRunToken> => {
    const run = await orm.TaskRun.where({ runId, userId }).select("runId").first();
    appAssert(run, NOT_FOUND, "Run not found");

    const publicAccessToken = await auth.createPublicToken({
        scopes: { read: { runs: [runId] } },
        expirationTime: RUN_TOKEN_EXPIRY,
    });

    return { runId, publicAccessToken };
};

/*
  Stop. Allowed for whoever started the run and for the project owner (a run locks the whole room's
  input, so the owner must always be able to release it). The room is unlocked straight away through the
  status feed; the task's own cancel hook then tidies up (typing caret, AI cursor).
 */
export const cancelRunService = async (userId: string, runId: string) => {
    const run = await orm.TaskRun.where({ runId }).first();
    appAssert(run, NOT_FOUND, "Run not found");
    const { role } = await assertProjectAccess(run.projectId, userId);
    appAssert(run.userId === userId || role === "owner", FORBIDDEN, "Only the person who started this run, or the project owner, can stop it", appErrorCode.Forbidden);
    appAssert(!run.completedAt, CONFLICT, "This run has already finished");

    try {
        await runs.cancel(runId);
    } catch (error) {
        // A run that just finished on its own is not an error worth surfacing; the status below still releases the room.
        console.warn(`[ai] cancel ${runId}:`, error);
    }

    await publishStatus(run.projectId, { kind: run.kind, runId, step: "error", text: "Stopped." });
    await recordRunResult(runId, { status: "cancelled" });
    return { cancelled: true };
};

/*
  Undo. Restores the graph as it was before the run. Only the most recent AI change can be undone,
  because an older snapshot would also wipe everything done after it; undoing repeatedly walks back
  through the history one run at a time.
 */
export const revertRunService = async (userId: string, runId: string) => {
    const run = await orm.TaskRun.where({ runId }).first();
    appAssert(run, NOT_FOUND, "Run not found");
    await assertProjectAccess(run.projectId, userId);
    appAssert(run.snapshotPath && run.status === "completed", BAD_REQUEST, "This run has nothing to undo");

    const history = await orm.TaskRun.where({ projectId: run.projectId }).orderBy((t) => t.createdAt.desc()).all();
    const latest = history.find((candidate) => candidate.snapshotPath && candidate.status === "completed");
    appAssert(latest?.runId === runId, CONFLICT, "Only the most recent AI change can be undone");

    const snapshot = await loadSnapshot(run.snapshotPath);
    appAssert(snapshot, NOT_FOUND, "The snapshot for this change is no longer available");

    await restoreGraph(run.projectId, snapshot);
    await orm.TaskRun.where({ runId }).update({ status: "reverted" });
    await markRunReverted(run.projectId, runId);
    await publishAssistantMessage(run.projectId, "↩ Undid the last AI change. The canvas is back to how it was before.");
    return { reverted: true };
};

const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null);

/** How this project's AI runs have gone, for the usage panel. Computed from the TaskRun rows. */
export const getUsageService = async (userId: string, projectId: string): Promise<AiUsageSummary> => {
    await assertProjectAccess(projectId, userId);
    const rows = await orm.TaskRun.where({ projectId }).orderBy((t) => t.createdAt.desc()).all();

    const finished = rows.filter((row) => row.status);
    const providers = new Map<string, { provider: string; model: string; latencies: number[]; runs: number }>();
    for (const row of rows) {
        if (!row.provider || !row.model) continue;
        const key = `${row.provider}/${row.model}`;
        const entry = providers.get(key) ?? { provider: row.provider, model: row.model, latencies: [], runs: 0 };
        entry.runs++;
        if (row.latencyMs !== null && row.latencyMs !== undefined) entry.latencies.push(row.latencyMs);
        providers.set(key, entry);
    }

    return {
        runs: rows.length,
        completed: finished.filter((row) => row.status === "completed" || row.status === "reverted").length,
        failed: finished.filter((row) => row.status === "failed").length,
        cancelled: finished.filter((row) => row.status === "cancelled").length,
        fellBack: rows.filter((row) => row.fellBack).length,
        avgLatencyMs: average(rows.flatMap((row) => (row.latencyMs !== null && row.latencyMs !== undefined ? [row.latencyMs] : []))),
        inputTokens: rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
        outputTokens: rows.reduce((sum, row) => sum + (row.outputTokens ?? 0), 0),
        byProvider: [...providers.values()]
            .sort((a, b) => b.runs - a.runs)
            .map(({ provider, model, runs: count, latencies }) => ({ provider, model, runs: count, avgLatencyMs: average(latencies) })),
        recent: rows.slice(0, 5).map((row) => ({
            kind: row.kind,
            provider: row.provider ?? null,
            model: row.model ?? null,
            latencyMs: row.latencyMs ?? null,
            status: row.status ?? null,
            createdAt: row.createdAt,
        })),
    };
};

export const startReviewRunService = async (userId: string, data: ReviewRequestSchema): Promise<AiRunStarted> => {
    const { project } = await assertProjectAccess(data.roomId, userId);

    const handle = await tasks.trigger<typeof reviewAgentTask>(
        "review-agent",
        { projectId: project.id, userId },
        { tags: tagsFor(project.id, userId) }
    );

    await recordRun(handle.id, "review", project.id, userId, "Architecture review");
    await publishStatus(project.id, { kind: "review", runId: handle.id, step: "queued", text: "Queued the architecture review…" });

    return { runId: handle.id, kind: "review", publicAccessToken: handle.publicAccessToken };
};

/*
  Applies one recommendation of a review. This is not a model call — the model already decided — so it
  runs here directly. The operations come from the review stored in the room, never from the request, and
  are re-checked against the canvas as it is now (it may have changed since the review). Like any AI
  edit it is snapshotted first, so Undo works on it.
 */
export const applyFixService = async (userId: string, data: ApplyFixRequestSchema) => {
    await assertProjectAccess(data.roomId, userId);

    const found = await findReview(data.roomId, data.reviewRunId);
    appAssert(found, NOT_FOUND, "Review not found");
    const recommendation = found.review.recommendations.find((candidate) => candidate.id === data.recommendationId);
    appAssert(recommendation, NOT_FOUND, "Recommendation not found");
    appAssert(!recommendation.applied, CONFLICT, "This fix was already applied");
    appAssert(recommendation.operations.length > 0, BAD_REQUEST, "This recommendation has no automatic fix");

    const graph = await readFlow(data.roomId);
    const { plan } = repairPlan(graph, { summary: "", operations: recommendation.operations });
    appAssert(plan.operations.length > 0, CONFLICT, "This fix no longer applies to the current canvas");

    const runId = `run_fix${crypto.randomBytes(8).toString("hex")}`;
    let snapshotPath: string | null = null;
    try {
        snapshotPath = await saveSnapshot(data.roomId, runId, graph);
    } catch (error) {
        console.warn("[ai] could not save the undo snapshot for a fix:", error);
    }

    const { applied } = await applyPlan(data.roomId, plan.operations, {
        positions: placeNewNodes(graph, plan.operations),
        stepDelayMs: 100,
    });
    appAssert(applied > 0, CONFLICT, "Nothing in this fix could be applied");

    await orm.TaskRun.create({
        runId,
        kind: "review",
        projectId: data.roomId,
        userId,
        prompt: `Apply fix: ${recommendation.title}`.slice(0, STORED_PROMPT_CHARS),
        status: "completed",
        completedAt: new Date().toISOString(),
        ...(snapshotPath ? { snapshotPath } : {}),
    });
    await markRecommendationApplied(data.roomId, found.messageId, found.review, recommendation.id);
    await publishAssistantMessage(data.roomId, `Applied: ${recommendation.title}`, { runId, canUndo: Boolean(snapshotPath) });

    return { applied, runId };
};

const DEFAULT_IMAGE_PROMPT = "Turn this sketch into an architecture diagram on the canvas";

/*
  Sketch to diagram. The image has already been size-limited and checked by its bytes (see the controller).
  It is stored privately for the task to read, and the task deletes it when the run ends; if the task can't
  even be triggered, it is deleted here.
 */
export const startImageDesignRunService = async (userId: string, query: ImageDesignQuery, image: { bytes: Buffer; mediaType: ImageType }): Promise<AiRunStarted> => {
    const { project } = await assertProjectAccess(query.roomId, userId);
    appAssert(getVisionChain().length > 0, INTERNAL_SERVER_ERROR, "Reading images needs a Gemini API key, which this server does not have configured");

    const prompt = query.prompt?.trim() || DEFAULT_IMAGE_PROMPT;
    const imagePath = await putBytes(storagePaths.upload(project.id, crypto.randomUUID(), EXTENSION[image.mediaType]), image.bytes, image.mediaType);

    let handle;
    try {
        handle = await tasks.trigger<typeof imageAgentTask>(
            "image-agent",
            { projectId: project.id, userId, prompt, imagePath, mediaType: image.mediaType },
            { tags: tagsFor(project.id, userId) }
        );
    } catch (error) {
        await removeObject(imagePath).catch(() => undefined);
        throw error;
    }

    await recordRun(handle.id, "image", project.id, userId, prompt);
    await publishStatus(project.id, { kind: "image", runId: handle.id, step: "queued", text: "Ghost AI is getting ready…" });

    return { runId: handle.id, kind: "image", publicAccessToken: handle.publicAccessToken };
};
