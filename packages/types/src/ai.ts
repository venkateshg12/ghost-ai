import { z } from "zod";
import { NODE_COLORS, NODE_SHAPES } from "./canvas";
import { projectIdSchema } from "./project";

// The two room-scoped feeds (served by the in-house realtime engine). Kept apart on purpose: chat is conversation, status is progress.
export const AI_CHAT_FEED = "ai-chat";
export const AI_STATUS_FEED = "ai-status-feed";

// design = Build mode, chat = Ask mode, review = architecture review, image = sketch to diagram.
export const AI_RUN_KINDS = ["design", "spec", "chat", "review", "image"] as const;
export type AiRunKind = (typeof AI_RUN_KINDS)[number];

/* ---------- Requests ---------- */

// build: edit the canvas. ask: answer a question about it, without touching it.
export const AI_MODES = ["build", "ask"] as const;
export type AiMode = (typeof AI_MODES)[number];

export const designRequestSchema = z.object({
    roomId: projectIdSchema,
    prompt: z.string().trim().min(1, { message: "Describe what to design" }).max(2000),
    mode: z.enum(AI_MODES).default("build"),
    // Nodes selected on the canvas. Checked against the room's graph on the server before use.
    focusNodeIds: z.array(z.string().min(1).max(200)).max(20).optional(),
});
export type DesignRequestSchema = z.infer<typeof designRequestSchema>;

export const chatHistoryItemSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4000),
});
export type ChatHistoryItem = z.infer<typeof chatHistoryItemSchema>;

// The graph itself is read from the room on the server, never taken from the client.
export const specRequestSchema = z.object({
    roomId: projectIdSchema,
    chatHistory: z.array(chatHistoryItemSchema).max(50).default([]),
});
export type SpecRequestSchema = z.infer<typeof specRequestSchema>;

// Trigger.dev run ids, e.g. "run_cm1a2b3c4d5e6f7g8h9i0j".
export const runIdSchema = z.string().regex(/^run_[a-z0-9]+$/i, { message: "Invalid run id" });

/* ---------- Feed payloads ---------- */

// Which model produced a reply and how it went, shown under the message.
export const aiMetaSchema = z.object({
    provider: z.string(),
    model: z.string(),
    label: z.string(),
    latencyMs: z.number(),
    /** True when the first-choice provider did not produce this result. */
    fellBack: z.boolean(),
    cached: z.boolean().optional(),
    inputTokens: z.number().optional(),
    outputTokens: z.number().optional(),
});
export type AiMeta = z.infer<typeof aiMetaSchema>;

export const chatMessagePayloadSchema = z.object({
    type: z.literal("chat"),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    // True while the reply is still being written; the content grows as it streams.
    streaming: z.boolean().optional(),
    runId: z.string().optional(),
    meta: aiMetaSchema.optional(),
    // Follow-up prompts offered as one-click chips under the reply.
    suggestions: z.array(z.string().max(200)).max(5).optional(),
    // The run changed the canvas and a snapshot exists, so it can be undone.
    canUndo: z.boolean().optional(),
    sender: z.object({
        id: z.string(),
        name: z.string(),
        avatar: z.string().nullish(),
        color: z.string().optional(),
    }),
});
export type ChatMessagePayload = z.infer<typeof chatMessagePayloadSchema>;

export const AI_STATUS_STEPS = ["queued", "start", "processing", "complete", "error"] as const;
export type AiStatusStep = (typeof AI_STATUS_STEPS)[number];

export const aiStatusPayloadSchema = z.object({
    type: z.literal("status"),
    kind: z.enum(AI_RUN_KINDS),
    runId: z.string(),
    step: z.enum(AI_STATUS_STEPS),
    text: z.string().optional(),
    specId: z.string().optional(),
    meta: aiMetaSchema.optional(),
});
export type AiStatusPayload = z.infer<typeof aiStatusPayloadSchema>;

/* ---------- Runs ---------- */

/*
  What the API returns when it starts an AI run: the Trigger.dev run id and a public access token
  scoped to read that one run, for `useRealtimeRun` in the browser.
 */
export interface AiRunStarted {
    runId: string;
    kind: AiRunKind;
    publicAccessToken: string;
}

export interface AiRunToken {
    runId: string;
    publicAccessToken: string;
}

/* ---------- Edit operations ---------- */

/*
  The edits the AI proposes. One flat object per operation rather than a union: structured output
  handles optional fields far more reliably than `anyOf`, and every field is validated again when it is
  applied. Shared so a review can carry its fixes in the same form a design plan does.
 */
export const DESIGN_OPERATION_TYPES = [
    "add_node",
    "update_node",
    "move_node",
    "resize_node",
    "delete_node",
    "add_edge",
    "delete_edge",
] as const;

const colorLabels = NODE_COLORS.map((pair) => pair.label) as [string, ...string[]];

export const designOperationSchema = z.object({
    type: z.enum(DESIGN_OPERATION_TYPES),
    id: z.string().describe("Node or edge id. New ids must be unique, short and kebab-case."),
    label: z.string().optional(),
    shape: z.enum(NODE_SHAPES).optional(),
    color: z.enum(colorLabels).optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    source: z.string().optional().describe("add_edge only: source node id"),
    target: z.string().optional().describe("add_edge only: target node id"),
});
export type DesignOperation = z.infer<typeof designOperationSchema>;

/* ---------- Image input ---------- */

// Only raster formats are accepted: SVG can carry scripts, and the model reads pixels anyway.
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

// The image itself is the request body; what goes in the query is small.
export const imageDesignQuerySchema = z.object({
    roomId: projectIdSchema,
    prompt: z.string().trim().max(500).optional(),
});
export type ImageDesignQuery = z.infer<typeof imageDesignQuerySchema>;

/* ---------- Review ---------- */

export const reviewRequestSchema = z.object({ roomId: projectIdSchema });
export type ReviewRequestSchema = z.infer<typeof reviewRequestSchema>;

// Apply one recommendation of a review. Only ids are sent: the operations are read back from the room.
export const applyFixRequestSchema = z.object({
    roomId: projectIdSchema,
    reviewRunId: z.string().min(1).max(100),
    recommendationId: z.string().min(1).max(100),
});
export type ApplyFixRequestSchema = z.infer<typeof applyFixRequestSchema>;

export const SEVERITIES = ["high", "medium", "low"] as const;

export const reviewRecommendationSchema = z.object({
    id: z.string(),
    title: z.string(),
    rationale: z.string(),
    severity: z.enum(SEVERITIES),
    // The edits that would implement it; empty for advice that has no mechanical fix.
    operations: z.array(designOperationSchema),
    applied: z.boolean().optional(),
});
export type ReviewRecommendation = z.infer<typeof reviewRecommendationSchema>;

// Written to the room's chat feed so the whole room sees the review, and so it persists with the conversation.
export const reviewPayloadSchema = z.object({
    type: z.literal("review"),
    runId: z.string(),
    summary: z.string(),
    /** The analyzer's health score when the review ran. */
    score: z.number(),
    recommendations: z.array(reviewRecommendationSchema),
    meta: aiMetaSchema.optional(),
});
export type ReviewPayload = z.infer<typeof reviewPayloadSchema>;

/* ---------- Usage ---------- */

// What the "AI usage" panel shows: how the project's AI runs have gone, from the TaskRun table.
export interface AiUsageSummary {
    runs: number;
    completed: number;
    failed: number;
    cancelled: number;
    /** Runs answered by a provider other than the first choice. */
    fellBack: number;
    avgLatencyMs: number | null;
    avgQueuedMs: number | null;
    inputTokens: number;
    outputTokens: number;
    byProvider: { provider: string; model: string; runs: number; avgLatencyMs: number | null }[];
    recent: { kind: AiRunKind; provider: string | null; model: string | null; latencyMs: number | null; status: string | null; createdAt: string }[];
}
