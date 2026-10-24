import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { analyzeGraph, suggestPrompts } from "@repo/types";
import { orm } from "../prisma/db";
import { publishAssistantMessage, publishStatus, readChatHistory, setAiPresence, updateAssistantMessage } from "../utils/realtime";
import { globalLimit, projectLimit } from "./limits";
import {
    AllProvidersFailedError,
    RunCancelledError,
    describeProviderFailure,
    readFlow,
    recordRunResult,
    streamChatAnswer,
    toAiMeta,
    toGraphInput,
} from "../utils/ai";

export const chatAgentPayloadSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    prompt: z.string().min(1).max(2000),
    focusNodeIds: z.array(z.string().min(1).max(200)).max(20).optional(),
});

export type ChatAgentPayload = z.infer<typeof chatAgentPayloadSchema>;

// How often the growing reply is pushed to the room. Each push is an HTTP call to the API plus a database write, so this is a rate, not a stream.
const STREAM_FLUSH_MS = 300;

/*
  Ask mode: answers a question about the diagram without touching it. The reply is written into the
  room's chat feed as it is generated, so everyone watches it appear; the conversation and the graph are
  both read from the room on the server, never from the client.
 */
export const chatAgentTask = schemaTask({
    id: "chat-agent",
    schema: chatAgentPayloadSchema,
    concurrency: [projectLimit, globalLimit],
    retry: { maxAttempts: 1 },
    run: async ({ projectId, prompt, focusNodeIds }, { ctx, signal }) => {
        const runId = ctx.run.id;
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));

        const project = await orm.Project.where({ id: projectId }).select("id").first();
        if (!project) {
            logger.warn("Project no longer exists; skipping", { projectId });
            return { status: "skipped" as const, reason: "Project not found" };
        }

        metadata.set("step", "start");

        let messageId: string | null = null;
        let latest = "";

        try {
            // Every call to the room costs a round trip, so the independent ones run together: the status and the
            // AI's "thinking" badge are posted while the graph and the conversation are being read.
            const [graph, history] = await Promise.all([
                readFlow(projectId),
                readChatHistory(projectId),
                publishStatus(projectId, { kind: "chat", runId, step: "start", text: "Plano is thinking…" }),
                setAiPresence(projectId, { cursor: null, thinking: true }),
            ]);
            const present = new Set(graph.nodes.map((node) => node.id));
            const focus = (focusNodeIds ?? []).filter((id) => present.has(id));

            metadata.set("step", "processing");
            // The reply message exists from the first moment, so the room sees it fill in.
            [, messageId] = await Promise.all([
                publishStatus(projectId, { kind: "chat", runId, step: "processing", text: "Plano is answering…" }),
                publishAssistantMessage(projectId, "", { runId, streaming: true }),
            ]);

            // Updates are chained so they land in order, and throttled so a fast model doesn't flood the API.
            let queue: Promise<void> = Promise.resolve();
            let lastFlush = 0;
            const flush = (text: string) => {
                if (!messageId) return;
                const id = messageId;
                queue = queue.then(() => updateAssistantMessage(projectId, id, text, { runId, streaming: true }));
            };

            const result = await streamChatAnswer({
                graph,
                history,
                prompt,
                focusNodeIds: focus,
                signal,
                onText: (text) => {
                    latest = text;
                    const now = Date.now();
                    if (now - lastFlush >= STREAM_FLUSH_MS) {
                        lastFlush = now;
                        flush(text);
                    }
                },
            });
            await queue;

            const aiMeta = toAiMeta(result.meta, result.usage);
            const graphInput = toGraphInput(graph);
            const extras = { runId, meta: aiMeta, suggestions: suggestPrompts(graphInput, analyzeGraph(graphInput)), streaming: false };
            if (messageId) await updateAssistantMessage(projectId, messageId, result.text, extras);
            else await publishAssistantMessage(projectId, result.text, extras);

            await publishStatus(projectId, { kind: "chat", runId, step: "complete", text: "Answered.", meta: aiMeta });
            await recordRunResult(runId, { status: "completed", meta: result.meta, usage: result.usage, queuedMs });
            metadata.set("step", "complete");
            return { status: "completed" as const };
        } catch (error) {
            // Whatever happened, a reply that was still streaming must stop showing a typing caret.
            const settle = async (text: string, extras: { runId: string } = { runId }) => {
                if (messageId) await updateAssistantMessage(projectId, messageId, text, { ...extras, streaming: false });
                else await publishAssistantMessage(projectId, text, extras);
            };

            if (error instanceof RunCancelledError) {
                await settle(latest ? `${latest}\n\n_(stopped)_` : "_(stopped)_");
                await publishStatus(projectId, { kind: "chat", runId, step: "error", text: "Stopped." });
                await recordRunResult(runId, { status: "cancelled", queuedMs });
                return { status: "cancelled" as const };
            }
            if (error instanceof AllProvidersFailedError) {
                logger.error("All AI providers failed", { attempts: error.attempts });
                await settle(describeProviderFailure(error));
                await publishStatus(projectId, { kind: "chat", runId, step: "error", text: "Couldn't answer." });
                await recordRunResult(runId, { status: "failed", queuedMs });
                return { status: "failed" as const, reason: "providers" };
            }
            await settle("Sorry — something went wrong while answering. Please try again.");
            throw error;
        } finally {
            await setAiPresence(projectId, { cursor: null, thinking: false });
        }
    },
    onFailure: async ({ payload, ctx }) => {
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));
        await publishStatus(payload.projectId, { kind: "design", runId: ctx.run.id, step: "error", text: "Couldn't answer." });
        await recordRunResult(ctx.run.id, { status: "failed", queuedMs });
    },
    onCancel: async ({ payload, ctx }) => {
        const queuedMs = Math.max(0, (ctx.run.startedAt?.getTime() ?? Date.now()) - (ctx.run.createdAt?.getTime() ?? Date.now()));
        await publishStatus(payload.projectId, { kind: "design", runId: ctx.run.id, step: "error", text: "Stopped." });
        await setAiPresence(payload.projectId, { cursor: null, thinking: false });
        await recordRunResult(ctx.run.id, { status: "cancelled", queuedMs });
    },
});
