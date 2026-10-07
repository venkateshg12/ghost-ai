import { logger, metadata, schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { orm } from "../prisma/db";
import { publishAssistantMessage, publishStatus, setAiPresence } from "../utils/liveblocks";
import {
    buildEdge,
    buildNode,
    editFlow,
    generateDesignPlan,
    MAX_NODE_SIZE,
    MIN_NODE_SIZE,
    readFlow,
    sizeOf,
    toColorPair,
    toShape,
    type DesignOperation,
    type FlowNode,
} from "../utils/ai";

export const designAgentPayloadSchema = z.object({
    projectId: z.string().uuid(),
    userId: z.string().uuid(),
    prompt: z.string().min(1).max(2000),
});

export type DesignAgentPayload = z.infer<typeof designAgentPayloadSchema>;

// A short pause between operations so collaborators see the design being drawn, not just appear.
const STEP_DELAY_MS = 120;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const centerOf = (node: FlowNode) => {
    const { width, height } = sizeOf(node);
    return { x: node.position.x + width / 2, y: node.position.y + height / 2 };
};

/*
  Applies one operation to the room. Every field the model produced is re-checked here — an id that
  doesn't exist, an edge to nowhere, or a size out of bounds is skipped or clamped, never written.
  Returns where the AI's cursor should point afterwards, or null if the operation was skipped.
 */
const applyOperation = async (roomId: string, op: DesignOperation) => {
    // Assigned inside the flow callback, so held in an object TypeScript won't narrow to `null`.
    const result: { cursor: { x: number; y: number } | null } = { cursor: null };

    await editFlow(roomId, (flow) => {
        const existing = flow.getNode(op.id);

        switch (op.type) {
            case "add_node": {
                if (existing) {
                    // The model re-added a node that's already there: treat it as an update.
                    flow.updateNodeData(op.id, {
                        ...(op.label ? { label: op.label } : {}),
                        ...(op.shape ? { shape: toShape(op.shape) } : {}),
                    });
                    result.cursor = centerOf(existing);
                    return;
                }
                const rightmost = flow.nodes.reduce((max, node) => Math.max(max, node.position.x + sizeOf(node).width), 0);
                const node = buildNode({
                    id: op.id,
                    label: op.label ?? "",
                    shape: op.shape,
                    color: op.color,
                    x: op.x ?? rightmost + 100,
                    y: op.y ?? 80,
                    width: op.width,
                    height: op.height,
                });
                flow.addNode(node);
                result.cursor = centerOf(node);
                return;
            }
            case "update_node": {
                if (!existing) return;
                const colors = op.color ? toColorPair(op.color) : null;
                flow.updateNodeData(op.id, {
                    ...(op.label !== undefined ? { label: op.label } : {}),
                    ...(op.shape ? { shape: toShape(op.shape) } : {}),
                    ...(colors ? { color: colors.bg, textColor: colors.text } : {}),
                });
                result.cursor = centerOf(existing);
                return;
            }
            case "move_node": {
                if (!existing || op.x === undefined || op.y === undefined) return;
                const position = { x: Math.round(op.x), y: Math.round(op.y) };
                flow.updateNode(op.id, { position });
                result.cursor = centerOf({ ...existing, position });
                return;
            }
            case "resize_node": {
                if (!existing || op.width === undefined || op.height === undefined) return;
                const width = clamp(op.width, MIN_NODE_SIZE.width, MAX_NODE_SIZE.width);
                const height = clamp(op.height, MIN_NODE_SIZE.height, MAX_NODE_SIZE.height);
                flow.updateNode(op.id, (node) => ({ ...node, style: { ...node.style, width, height } }));
                result.cursor = centerOf(existing);
                return;
            }
            case "delete_node": {
                if (!existing) return;
                // Edges attached to a removed node would dangle, so they go with it.
                const attached = flow.edges
                    .filter((edge) => edge.source === op.id || edge.target === op.id)
                    .map((edge) => edge.id);
                flow.removeEdges(attached);
                flow.removeNode(op.id);
                result.cursor = centerOf(existing);
                return;
            }
            case "add_edge": {
                if (!op.source || !op.target || op.source === op.target) return;
                const source = flow.getNode(op.source);
                if (!source || !flow.getNode(op.target)) return;
                flow.addEdge(buildEdge({ id: op.id, source: op.source, target: op.target, label: op.label }));
                result.cursor = centerOf(source);
                return;
            }
            case "delete_edge": {
                if (!flow.getEdge(op.id)) return;
                flow.removeEdge(op.id);
                return;
            }
        }
    });

    return result.cursor;
};

/*
  Prompt -> Gemini edit operations -> applied to the shared room. Everyone in the room sees the
  canvas change through Liveblocks, the AI cursor moving, and progress in `ai-status-feed`; the run's
  own status and `metadata.step` reach the user who started it through `useRealtimeRun`.
 */
export const designAgentTask = schemaTask({
    id: "design-agent",
    schema: designAgentPayloadSchema,
    run: async ({ projectId, prompt }, { ctx }) => {
        const runId = ctx.run.id;

        // The project may have been deleted while the run waited in the queue.
        const project = await orm.Project.where({ id: projectId }).select("id").first();
        if (!project) {
            logger.warn("Project no longer exists; skipping", { projectId });
            return { status: "skipped" as const, reason: "Project not found" };
        }

        metadata.set("step", "start");
        await publishStatus(projectId, { kind: "design", runId, step: "start", text: "Ghost AI is reading the canvas…" });
        await setAiPresence(projectId, { cursor: null, thinking: true });

        try {
            const graph = await readFlow(projectId);
            logger.info("Canvas read", { nodes: graph.nodes.length, edges: graph.edges.length });

            const plan = await generateDesignPlan(prompt, graph);
            logger.info("Plan generated", { operations: plan.operations.length });

            metadata.set("step", "processing").set("total", plan.operations.length).set("applied", 0);
            await publishStatus(projectId, {
                kind: "design",
                runId,
                step: "processing",
                text: `Drawing ${plan.operations.length} changes on the canvas…`,
            });

            let applied = 0;
            for (const operation of plan.operations) {
                const cursor = await applyOperation(projectId, operation);
                if (cursor) {
                    applied++;
                    metadata.set("applied", applied);
                    await setAiPresence(projectId, { cursor, thinking: true });
                    await sleep(STEP_DELAY_MS);
                }
            }

            metadata.set("step", "complete");
            await publishStatus(projectId, { kind: "design", runId, step: "complete", text: plan.summary });
            await publishAssistantMessage(projectId, plan.summary);

            return { status: "completed" as const, operations: plan.operations.length, applied };
        } finally {
            await setAiPresence(projectId, { cursor: null, thinking: false });
        }
    },
    // Only after the last retry: an earlier failed attempt is retried silently.
    onFailure: async ({ payload, ctx }) => {
        await publishStatus(payload.projectId, { kind: "design", runId: ctx.run.id, step: "error", text: "Design generation failed." });
        await publishAssistantMessage(payload.projectId, "Sorry — I couldn't generate that design. Please try again.");
    },
});
