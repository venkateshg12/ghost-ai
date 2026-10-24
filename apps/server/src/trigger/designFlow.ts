import { logger, metadata } from "@trigger.dev/sdk";
import { analyzeGraph, suggestPrompts, type AiRunKind } from "@repo/types";
import { orm } from "../prisma/db";
import { removeObject } from "../utils/storage";
import { publishAssistantMessage, publishStatus, setAiPresence } from "../utils/realtime";
import {
    AllProvidersFailedError,
    NoVisionProviderError,
    PlanQualityError,
    RunCancelledError,
    applyPlan,
    describeProviderFailure,
    placeNewNodes,
    readFlow,
    recordRunResult,
    saveSnapshot,
    toAiMeta,
    toGraphInput,
    type DesignResult,
    type FlowGraph,
    type PlanProgress,
} from "../utils/ai";

interface DesignFlowOptions {
    projectId: string;
    runId: string;
    kind: Extract<AiRunKind, "design" | "image">;
    /** What the status line says while the model is working. */
    startText: string;
    signal?: AbortSignal;
    queuedMs?: number;
    /** Produces the edit plan. Everything else (apply, undo snapshot, reporting) is shared. `onProgress` is called as the plan is written. */
    generate: (graph: FlowGraph, onProgress: (progress: PlanProgress) => void) => Promise<DesignResult>;
    /** Runs when the flow ends for any reason, e.g. to delete an uploaded image. */
    cleanup?: () => Promise<void>;
}

// How often "planning" progress is posted. Each post is a REST call to the room, so this is a rate, not a stream.
const PROGRESS_INTERVAL_MS = 2_500;
// NVIDIA returns structured output in one piece at the end (measured: 1 chunk after 7s for 3.3k characters), so a
// provider that cannot stream gives no real progress. A heartbeat tells the room the AI is still working, honestly.
const HEARTBEAT_INTERVAL_MS = 3_000;

/*
  Everything that happens around an AI-produced edit plan, whichever way the plan was produced (a text
  prompt or a sketch): read the room, ask `generate`, snapshot for Undo, place new nodes, write them, and
  report to the room and to the run record. Failures that are expected (providers down, a plan that is not
  good enough, the user pressing Stop) are reported and end the run normally; anything else is thrown.
 */
export const executeDesignFlow = async ({ projectId, runId, kind, startText, signal, queuedMs, generate, cleanup }: DesignFlowOptions) => {
    // The project may have been deleted while the run waited in the queue.
    const project = await orm.Project.where({ id: projectId }).select("id").first();
    if (!project) {
        logger.warn("Project no longer exists; skipping", { projectId });
        await cleanup?.();
        return { status: "skipped" as const, reason: "Project not found" };
    }

    metadata.set("step", "start");
    await publishStatus(projectId, { kind, runId, step: "start", text: startText });
    await setAiPresence(projectId, { cursor: null, thinking: true });

    try {
        const graph = await readFlow(projectId);
        logger.info("Canvas read", { nodes: graph.nodes.length, edges: graph.edges.length });

        // The undo snapshot is only a copy of what was just read, so it is written while the model works rather than after.
        const snapshot = saveSnapshot(projectId, runId, graph).catch((error: unknown) => {
            // Undo needs the "before" graph; if storage is down the run still goes ahead, just without Undo.
            logger.warn("Could not save the undo snapshot", { error: String(error) });
            return null;
        });

        // The model takes seconds to write a plan; say how far it has got instead of going quiet.
        let lastProgress = { at: 0, text: "" };
        const onProgress = ({ nodes, edges }: PlanProgress) => {
            if (nodes === 0) return;
            const text = `Planning… ${nodes} component${nodes === 1 ? "" : "s"}${edges ? `, ${edges} connection${edges === 1 ? "" : "s"}` : ""} so far`;
            const now = Date.now();
            if (text === lastProgress.text || now - lastProgress.at < PROGRESS_INTERVAL_MS) return;
            lastProgress = { at: now, text };
            void publishStatus(projectId, { kind, runId, step: "processing", text });
        };

        const startedAt = Date.now();
        const heartbeat = setInterval(() => {
            // Real progress, when there is some, is more informative than a timer.
            if (Date.now() - lastProgress.at < HEARTBEAT_INTERVAL_MS) return;
            void publishStatus(projectId, { kind, runId, step: "processing", text: `Designing… ${Math.round((Date.now() - startedAt) / 1000)}s` });
        }, HEARTBEAT_INTERVAL_MS);

        let generated: DesignResult;
        try {
            generated = await generate(graph, onProgress);
        } finally {
            clearInterval(heartbeat);
        }
        const { plan, meta, usage, dropped } = generated;
        const operations = plan.operations;
        logger.info("Plan generated", { provider: meta.provider, model: meta.modelId, latencyMs: meta.latencyMs, operations: operations.length, dropped });

        const aiMeta = toAiMeta(meta, usage);

        // Nothing to draw: the model answered a question, or the request needed no change.
        if (operations.length === 0) {
            // The snapshot was written in case the run changed something; this one changed nothing, so drop it.
            void snapshot.then(async (path) => {
                if (path) await removeObject(path).catch(() => undefined);
            });
            await publishAssistantMessage(projectId, plan.summary, { runId, meta: aiMeta, suggestions: suggestPrompts(toGraphInput(graph)) });
            await publishStatus(projectId, { kind, runId, step: "complete", text: plan.summary, meta: aiMeta });
            await recordRunResult(runId, { status: "completed", meta, usage });
            metadata.set("step", "complete");
            return { status: "completed" as const, operations: 0, applied: 0 };
        }

        metadata.set("step", "processing").set("total", operations.length).set("applied", 0);
        await publishStatus(projectId, { kind, runId, step: "processing", text: `Drawing ${operations.length} changes with ${meta.label}…`, meta: aiMeta });

        const snapshotPath = await snapshot;

        const { applied } = await applyPlan(projectId, operations, {
            positions: placeNewNodes(graph, operations),
            signal,
            // Not awaited: the cursor is decoration and must never slow the drawing down.
            onStep: ({ applied: done, cursor }) => {
                metadata.set("applied", done);
                if (cursor) void setAiPresence(projectId, { cursor, thinking: true });
            },
        });

        const finalGraph = toGraphInput(await readFlow(projectId));
        await publishAssistantMessage(projectId, plan.summary, {
            runId,
            meta: aiMeta,
            suggestions: suggestPrompts(finalGraph, analyzeGraph(finalGraph)),
            canUndo: Boolean(snapshotPath) && applied > 0,
        });
        await publishStatus(projectId, { kind, runId, step: "complete", text: plan.summary, meta: aiMeta });
        await recordRunResult(runId, { status: "completed", meta, usage, snapshotPath, queuedMs });

        metadata.set("step", "complete");
        return { status: "completed" as const, operations: operations.length, applied };
    } catch (error) {
        if (error instanceof RunCancelledError) {
            await publishStatus(projectId, { kind, runId, step: "error", text: "Stopped." });
            await recordRunResult(runId, { status: "cancelled", queuedMs });
            return { status: "cancelled" as const };
        }
        if (error instanceof AllProvidersFailedError) {
            logger.error("All AI providers failed", { attempts: error.attempts });
            await publishStatus(projectId, { kind, runId, step: "error", text: kind === "image" ? "Couldn't read the sketch." : "Design generation failed." });
            await publishAssistantMessage(projectId, describeProviderFailure(error), { runId });
            await recordRunResult(runId, { status: "failed", queuedMs });
            return { status: "failed" as const, reason: "providers" };
        }
        if (error instanceof NoVisionProviderError || error instanceof PlanQualityError) {
            await publishStatus(projectId, { kind, runId, step: "error", text: "Couldn't read the sketch." });
            await publishAssistantMessage(projectId, error instanceof NoVisionProviderError ? "Reading images needs a Gemini API key, which this server doesn't have configured." : "I couldn't recognise enough of an architecture in that image. Try a clearer, closer photo with readable labels.", { runId });
            await recordRunResult(runId, { status: "failed", queuedMs });
            return { status: "failed" as const, reason: "image" };
        }
        throw error;
    } finally {
        await setAiPresence(projectId, { cursor: null, thinking: false });
        await cleanup?.();
    }
};
