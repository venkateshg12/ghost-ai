import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { chatHistoryItemSchema } from "@repo/types";
import { orm } from "../prisma/db";
import { publishAssistantMessage, publishStatus, setAiPresence } from "../utils/realtime";
import { AllProvidersFailedError, RunCancelledError, describeProviderFailure, generateSpecMarkdown, readFlow, recordRunResult, toAiMeta } from "../utils/ai";
import { createSpecRecord } from "../services/spec.service";
import { globalLimit, projectLimit } from "./limits";

export const generateSpecPayloadSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    chatHistory: z.array(chatHistoryItemSchema).max(50).default([]),
});

export type GenerateSpecPayload = z.infer<typeof generateSpecPayloadSchema>;

/*
  Canvas graph (read from the room, never from the client) + recent chat -> Markdown spec. The
  Markdown goes to blob storage and a ProjectSpec row records where; the output carries the spec's id
  so the starter's `useRealtimeRun` can open it.
 */
export const generateSpecTask = schemaTask({
    id: "generate-spec",
    schema: generateSpecPayloadSchema,
    concurrency: [projectLimit, globalLimit],
    retry: { maxAttempts: 1 },
    run: async ({ projectId, chatHistory }, { ctx, signal }) => {
        const runId = ctx.run.id;
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));

        const project = await orm.Project.where({ id: projectId }).select("id", "name").first();
        if (!project) {
            logger.warn("Project no longer exists; skipping", { projectId });
            return { status: "skipped" as const, reason: "Project not found" };
        }

        metadata.set("step", "start");
        await publishStatus(projectId, { kind: "spec", runId, step: "start", text: "Reading the canvas architecture…" });
        await setAiPresence(projectId, { cursor: null, thinking: true });

        try {
            const graph = await readFlow(projectId);
            logger.info("Canvas read", { nodes: graph.nodes.length, edges: graph.edges.length });

            metadata.set("step", "processing");
            await publishStatus(projectId, { kind: "spec", runId, step: "processing", text: "Writing the technical specification…" });
            const { markdown, meta, usage } = await generateSpecMarkdown({ projectName: project.name, graph, chatHistory }, { signal });
            const aiMeta = toAiMeta(meta, usage);

            const spec = await createSpecRecord(projectId, project.name, markdown);
            logger.info("Spec saved", { specId: spec.id, chars: markdown.length });

            metadata.set("step", "complete").set("specId", spec.id);
            await publishStatus(projectId, {
                kind: "spec",
                runId,
                step: "complete",
                text: "Technical spec is ready in the Specs tab.",
                specId: spec.id,
                meta: aiMeta,
            });
            await publishAssistantMessage(
                projectId,
                `I wrote a technical spec from the canvas: ${spec.fileName}. Open the Specs tab to preview or download it.`,
                { runId, meta: aiMeta }
            );
            await recordRunResult(runId, { status: "completed", meta, usage, queuedMs });

            return { status: "completed" as const, specId: spec.id };
        } catch (error) {
            if (error instanceof RunCancelledError) {
                await publishStatus(projectId, { kind: "spec", runId, step: "error", text: "Stopped." });
                await recordRunResult(runId, { status: "cancelled", queuedMs });
                return { status: "cancelled" as const };
            }
            if (error instanceof AllProvidersFailedError) {
                await publishStatus(projectId, { kind: "spec", runId, step: "error", text: "Spec generation failed." });
                await publishAssistantMessage(projectId, describeProviderFailure(error), { runId });
                await recordRunResult(runId, { status: "failed", queuedMs });
                return { status: "failed" as const, reason: "providers" };
            }
            throw error;
        } finally {
            await setAiPresence(projectId, { cursor: null, thinking: false });
        }
    },
    onFailure: async ({ payload, ctx }) => {
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));
        await publishStatus(payload.projectId, { kind: "spec", runId: ctx.run.id, step: "error", text: "Spec generation failed." });
        await recordRunResult(ctx.run.id, { status: "failed", queuedMs });
    },
});
