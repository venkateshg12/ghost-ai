import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { generateDesignPlan, recordRunResult } from "../utils/ai";
import { publishAssistantMessage, publishStatus, setAiPresence } from "../utils/liveblocks";
import { executeDesignFlow } from "./designFlow";

export const designAgentPayloadSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    prompt: z.string().min(1).max(2000),
    focusNodeIds: z.array(z.string().min(1).max(200)).max(20).optional(),
});

export type DesignAgentPayload = z.infer<typeof designAgentPayloadSchema>;

/*
  Build mode: prompt -> provider chain (NVIDIA, then Gemini) -> repaired, quality-checked edit plan -> applied
  to the shared room. The shared flow (designFlow.ts) does everything around the plan, including the undo
  snapshot; this task only says how the plan is produced.
 */
export const designAgentTask = schemaTask({
    id: "design-agent",
    schema: designAgentPayloadSchema,
    // Provider retries and fallback happen inside the run; a task-level retry would repeat a long wait.
    retry: { maxAttempts: 1 },
    run: async ({ projectId, prompt, focusNodeIds }, { ctx, signal }) =>
        executeDesignFlow({
            projectId,
            runId: ctx.run.id,
            kind: "design",
            startText: "Ghost AI is reading the canvas…",
            signal,
            generate: (graph, onProgress) => {
                // Only ids that exist in the room count: the client's selection is a hint, never trusted.
                const present = new Set(graph.nodes.map((node) => node.id));
                return generateDesignPlan(prompt, graph, { focusNodeIds: (focusNodeIds ?? []).filter((id) => present.has(id)), signal, onProgress });
            },
        }),
    // An unexpected error (not a provider failure, which the flow reports itself).
    onFailure: async ({ payload, ctx }) => {
        await publishStatus(payload.projectId, { kind: "design", runId: ctx.run.id, step: "error", text: "Design generation failed." });
        await publishAssistantMessage(payload.projectId, "Sorry — something went wrong while drawing that. Please try again.", { runId: ctx.run.id });
        await recordRunResult(ctx.run.id, { status: "failed" });
    },
    // The user pressed Stop and the run was cancelled from outside, before it could clean up itself.
    onCancel: async ({ payload, ctx }) => {
        await publishStatus(payload.projectId, { kind: "design", runId: ctx.run.id, step: "error", text: "Stopped." });
        await setAiPresence(payload.projectId, { cursor: null, thinking: false });
        await recordRunResult(ctx.run.id, { status: "cancelled" });
    },
});
