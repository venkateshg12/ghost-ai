import { logger, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { IMAGE_TYPES } from "@repo/types";
import { generateImagePlan, recordRunResult } from "../utils/ai";
import { publishAssistantMessage, publishStatus, setAiPresence } from "../utils/realtime";
import { readBytes, removeObject } from "../utils/storage";
import { executeDesignFlow } from "./designFlow";
import { globalLimit, projectLimit } from "./limits";

export const imageAgentPayloadSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    prompt: z.string().min(1).max(500),
    imagePath: z.string().min(1).max(500),
    mediaType: z.enum(IMAGE_TYPES),
});

export type ImageAgentPayload = z.infer<typeof imageAgentPayloadSchema>;

/*
  Sketch to diagram: the uploaded image (stored privately by the API) is shown to a vision-capable model,
  and its plan goes through the same repair, quality gate, placement, undo snapshot and reporting as a text
  prompt. The image is deleted as soon as the run ends: it is only needed to produce the plan.
 */
export const imageAgentTask = schemaTask({
    id: "image-agent",
    schema: imageAgentPayloadSchema,
    concurrency: [projectLimit, globalLimit],
    retry: { maxAttempts: 1 },
    run: async ({ projectId, prompt, imagePath, mediaType }, { ctx, signal }) => {
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));
        return executeDesignFlow({
            projectId,
            runId: ctx.run.id,
            kind: "image",
            startText: "Plano is looking at your sketch…",
            signal,
            queuedMs,
            generate: async (graph) => {
                const bytes = await readBytes(imagePath);
                if (!bytes) throw new Error("The uploaded image is no longer available");
                return generateImagePlan({ bytes, mediaType }, prompt, graph, { signal });
            },
            cleanup: () =>
                removeObject(imagePath).catch((error) => {
                    logger.warn("Could not delete the uploaded image", { error: String(error) });
                }),
        });
    },
    onFailure: async ({ payload, ctx }) => {
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));
        await publishStatus(payload.projectId, { kind: "image", runId: ctx.run.id, step: "error", text: "Couldn't read the sketch." });
        await publishAssistantMessage(payload.projectId, "Sorry — something went wrong while reading that image. Please try again.", { runId: ctx.run.id });
        await recordRunResult(ctx.run.id, { status: "failed", queuedMs });
        await removeObject(payload.imagePath).catch(() => undefined);
    },
    onCancel: async ({ payload, ctx }) => {
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));
        await publishStatus(payload.projectId, { kind: "image", runId: ctx.run.id, step: "error", text: "Stopped." });
        await setAiPresence(payload.projectId, { cursor: null, thinking: false });
        await recordRunResult(ctx.run.id, { status: "cancelled", queuedMs });
        await removeObject(payload.imagePath).catch(() => undefined);
    },
});
