import { z } from "zod";
import { projectIdSchema } from "./project";

// The two room-scoped Liveblocks feeds. Kept apart on purpose: chat is conversation, status is progress.
export const AI_CHAT_FEED = "ai-chat";
export const AI_STATUS_FEED = "ai-status-feed";

export const AI_RUN_KINDS = ["design", "spec"] as const;
export type AiRunKind = (typeof AI_RUN_KINDS)[number];

/* ---------- Requests ---------- */

export const designRequestSchema = z.object({
    roomId: projectIdSchema,
    prompt: z.string().trim().min(1, { message: "Describe what to design" }).max(2000),
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

export const chatMessagePayloadSchema = z.object({
    type: z.literal("chat"),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    sender: z.object({
        id: z.string(),
        name: z.string(),
        avatar: z.string().optional(),
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
