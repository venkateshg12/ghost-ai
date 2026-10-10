import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { orm } from "../prisma/db";
import { publishAssistantMessage, publishReview, publishStatus, setAiPresence } from "../utils/liveblocks";
import { AllProvidersFailedError, RunCancelledError, describeProviderFailure, generateReview, readFlow, recordRunResult, toAiMeta } from "../utils/ai";

export const reviewAgentPayloadSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
});

// Fewer components than this and there is nothing worth reviewing yet.
const MIN_NODES_TO_REVIEW = 2;

/*
  Architecture review: the shared graph analyzer's findings (facts) plus the model's judgement become a
  short list of prioritised recommendations, each carrying the canvas edits that would implement it. The
  result is written to the room's chat feed; applying a recommendation is a separate, explicit step.
 */
export const reviewAgentTask = schemaTask({
    id: "review-agent",
    schema: reviewAgentPayloadSchema,
    retry: { maxAttempts: 1 },
    run: async ({ projectId }, { ctx, signal }) => {
        const runId = ctx.run.id;

        const project = await orm.Project.where({ id: projectId }).select("id").first();
        if (!project) {
            logger.warn("Project no longer exists; skipping", { projectId });
            return { status: "skipped" as const, reason: "Project not found" };
        }

        metadata.set("step", "start");
        await publishStatus(projectId, { kind: "review", runId, step: "start", text: "Ghost AI is reviewing the architecture…" });
        await setAiPresence(projectId, { cursor: null, thinking: true });

        try {
            const graph = await readFlow(projectId);
            if (graph.nodes.length < MIN_NODES_TO_REVIEW) {
                await publishAssistantMessage(projectId, "There is not enough on the canvas to review yet. Add a few components, or ask me to design something, and then run the review.", { runId });
                await publishStatus(projectId, { kind: "review", runId, step: "complete", text: "Nothing to review yet." });
                await recordRunResult(runId, { status: "completed" });
                return { status: "completed" as const, recommendations: 0 };
            }

            metadata.set("step", "processing");
            await publishStatus(projectId, { kind: "review", runId, step: "processing", text: "Analysing the design…" });

            const { summary, recommendations, score, meta, usage } = await generateReview(graph, { signal });
            const aiMeta = toAiMeta(meta, usage);

            await publishReview(projectId, { type: "review", runId, summary, score, recommendations, meta: aiMeta });
            await publishAssistantMessage(projectId, `I reviewed the architecture and have ${recommendations.length} recommendation${recommendations.length === 1 ? "" : "s"}. Open the Review tab to see them and apply fixes.`, { runId, meta: aiMeta });
            await publishStatus(projectId, { kind: "review", runId, step: "complete", text: summary, meta: aiMeta });
            await recordRunResult(runId, { status: "completed", meta, usage });

            metadata.set("step", "complete");
            return { status: "completed" as const, recommendations: recommendations.length };
        } catch (error) {
            if (error instanceof RunCancelledError) {
                await publishStatus(projectId, { kind: "review", runId, step: "error", text: "Stopped." });
                await recordRunResult(runId, { status: "cancelled" });
                return { status: "cancelled" as const };
            }
            if (error instanceof AllProvidersFailedError) {
                logger.error("All AI providers failed", { attempts: error.attempts });
                await publishStatus(projectId, { kind: "review", runId, step: "error", text: "Review failed." });
                await publishAssistantMessage(projectId, describeProviderFailure(error), { runId });
                await recordRunResult(runId, { status: "failed" });
                return { status: "failed" as const, reason: "providers" };
            }
            throw error;
        } finally {
            await setAiPresence(projectId, { cursor: null, thinking: false });
        }
    },
    onFailure: async ({ payload, ctx }) => {
        await publishStatus(payload.projectId, { kind: "review", runId: ctx.run.id, step: "error", text: "Review failed." });
        await recordRunResult(ctx.run.id, { status: "failed" });
    },
    onCancel: async ({ payload, ctx }) => {
        await publishStatus(payload.projectId, { kind: "review", runId: ctx.run.id, step: "error", text: "Stopped." });
        await setAiPresence(payload.projectId, { cursor: null, thinking: false });
        await recordRunResult(ctx.run.id, { status: "cancelled" });
    },
});
