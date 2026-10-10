import { Liveblocks, LiveblocksError } from "@liveblocks/node";
import {
    AI_CHAT_FEED,
    AI_STATUS_FEED,
    chatMessagePayloadSchema,
    reviewPayloadSchema,
    type AiStatusPayload,
    type ChatMessagePayload,
    type ReviewPayload,
} from "@repo/types";
import { LIVEBLOCKS_SECRET_KEY } from "../constants/env";

// One client for the whole process. It only holds a secret and a fetch wrapper, so it is cheap.
export const liveblocks = new Liveblocks({ secret: LIVEBLOCKS_SECRET_KEY });

// The AI shows up in the room as its own participant, with a cursor and a "thinking" badge.
export const AI_PARTICIPANT = {
    id: "ghost-ai",
    name: "Ghost AI",
    color: "#6457f9",
} as const;

const CURSOR_COLORS = [
    "#f87171", // Light Red
    "#f472b6", // Pink
    "#c084fc", // Purple
    "#818cf8", // Indigo
    "#60a5fa", // Blue
    "#38bdf8", // Sky
    "#2dd4bf", // Teal
    "#34d399", // Emerald
    "#a3e635", // Lime
    "#fbbf24", // Amber
    "#fb923c", // Orange
];

// The same user always gets the same cursor colour, in every room and on every device.
export const getUserColor = (userId: string): string => {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CURSOR_COLORS[Math.abs(hash % CURSOR_COLORS.length)]!;
};

const isConflict = (error: unknown) => error instanceof LiveblocksError && error.status === 409;

/*
  Rooms are private (no default access): the only way in is a token from our auth route, which checks
  project membership first. The two feeds are created with the room so neither the browser nor a job
  ever has to race to create them. Safe to call on every token request — existing ones are kept.
 */
export const ensureRoom = async (roomId: string) => {
    await liveblocks.getOrCreateRoom(roomId, { defaultAccesses: [] });

    for (const feedId of [AI_CHAT_FEED, AI_STATUS_FEED]) {
        try {
            await liveblocks.createFeed({ roomId, feedId });
        } catch (error) {
            if (!isConflict(error)) throw error;
        }
    }
};

/*
  Status updates are progress, not data: a failure to publish one is logged and swallowed so it can
  never fail the job that produced it.
 */
export const publishStatus = async (roomId: string, status: Omit<AiStatusPayload, "type">) => {
    try {
        await liveblocks.createFeedMessage({
            roomId,
            feedId: AI_STATUS_FEED,
            data: { type: "status", ...status },
        });
    } catch (error) {
        console.warn(`[Liveblocks] status publish failed for room ${roomId}:`, error);
    }
};

type AssistantExtras = Partial<Pick<ChatMessagePayload, "streaming" | "runId" | "meta" | "suggestions" | "canUndo">>;

// Feed data must be plain JSON: round-tripping drops `undefined` fields instead of sending them.
const toJson = <T>(value: T) => JSON.parse(JSON.stringify(value)) as T;

export const assistantPayload = (content: string, extras: AssistantExtras = {}): ChatMessagePayload => ({
    type: "chat",
    role: "assistant",
    content,
    sender: { id: AI_PARTICIPANT.id, name: AI_PARTICIPANT.name, color: AI_PARTICIPANT.color },
    ...extras,
});

/** Posts a Ghost AI reply to the room's chat. Returns the message id (to stream into), or null if it could not be posted. */
export const publishAssistantMessage = async (roomId: string, content: string, extras: AssistantExtras = {}): Promise<string | null> => {
    try {
        const message = await liveblocks.createFeedMessage({
            roomId,
            feedId: AI_CHAT_FEED,
            data: toJson(assistantPayload(content, extras)),
        });
        return message.id;
    } catch (error) {
        console.warn(`[Liveblocks] chat publish failed for room ${roomId}:`, error);
        return null;
    }
};

/*
  Rewrites a message in place. Used to stream a reply: everyone in the room sees the same message
  grow. A failed update is logged and skipped — the next one carries the full text anyway.
 */
export const updateAssistantMessage = async (roomId: string, messageId: string, content: string, extras: AssistantExtras = {}) => {
    try {
        await liveblocks.updateFeedMessage({
            roomId,
            feedId: AI_CHAT_FEED,
            messageId,
            data: toJson(assistantPayload(content, extras)),
        });
    } catch (error) {
        console.warn(`[Liveblocks] chat update failed for room ${roomId}:`, error);
    }
};

export interface HistoryMessage {
    role: "user" | "assistant";
    content: string;
}

/*
  The recent conversation, read from the room's feed rather than taken from the client: it includes
  teammates' messages and cannot be forged by one browser. Messages still streaming are left out.
 */
export const readChatHistory = async (roomId: string, limit = 12): Promise<HistoryMessage[]> => {
    try {
        const { data } = await liveblocks.getFeedMessages({ roomId, feedId: AI_CHAT_FEED });
        return data
            .flatMap((message) => {
                const parsed = chatMessagePayloadSchema.safeParse(message.data);
                return parsed.success && !parsed.data.streaming ? [{ createdAt: message.createdAt, ...parsed.data }] : [];
            })
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(-limit)
            .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    } catch (error) {
        console.warn(`[Liveblocks] reading chat history failed for room ${roomId}:`, error);
        return [];
    }
};

/*
  Puts the AI's cursor on the canvas at a flow position while it works, or takes it away. Presence set
  from the server expires on its own after `ttl` seconds, so a crashed job can't leave it stuck.
 */
export const setAiPresence = async (
    roomId: string,
    presence: { cursor: { x: number; y: number } | null; thinking: boolean }
) => {
    try {
        await liveblocks.setPresence(roomId, {
            userId: AI_PARTICIPANT.id,
            data: { cursor: presence.cursor, thinking: presence.thinking, isThinking: presence.thinking },
            userInfo: { name: AI_PARTICIPANT.name, avatar: "", color: AI_PARTICIPANT.color },
            ttl: presence.thinking ? 120 : 2,
        });
    } catch (error) {
        console.warn(`[Liveblocks] AI presence update failed for room ${roomId}:`, error);
    }
};

/** After an undo, the original reply must stop offering Undo (and nothing older should either). */
export const markRunReverted = async (roomId: string, runId: string) => {
    try {
        const { data } = await liveblocks.getFeedMessages({ roomId, feedId: AI_CHAT_FEED });
        for (const message of data) {
            const parsed = chatMessagePayloadSchema.safeParse(message.data);
            if (parsed.success && parsed.data.runId === runId && parsed.data.canUndo) {
                await liveblocks.updateFeedMessage({
                    roomId,
                    feedId: AI_CHAT_FEED,
                    messageId: message.id,
                    data: toJson({ ...parsed.data, canUndo: false }),
                });
            }
        }
    } catch (error) {
        console.warn(`[Liveblocks] could not clear Undo for run ${runId}:`, error);
    }
};

/** Posts a review into the room's chat feed, where the Review tab (and everyone in the room) reads it. */
export const publishReview = async (roomId: string, review: ReviewPayload): Promise<string | null> => {
    try {
        const message = await liveblocks.createFeedMessage({ roomId, feedId: AI_CHAT_FEED, data: toJson(review) });
        return message.id;
    } catch (error) {
        console.warn(`[Liveblocks] review publish failed for room ${roomId}:`, error);
        return null;
    }
};

/** A review, found by the run that produced it, read from the room (so a client can't supply its own operations). */
export const findReview = async (roomId: string, reviewRunId: string): Promise<{ messageId: string; review: ReviewPayload } | null> => {
    const { data } = await liveblocks.getFeedMessages({ roomId, feedId: AI_CHAT_FEED });
    for (const message of data) {
        const parsed = reviewPayloadSchema.safeParse(message.data);
        if (parsed.success && parsed.data.runId === reviewRunId) return { messageId: message.id, review: parsed.data };
    }
    return null;
};

export const markRecommendationApplied = async (roomId: string, messageId: string, review: ReviewPayload, recommendationId: string) => {
    try {
        await liveblocks.updateFeedMessage({
            roomId,
            feedId: AI_CHAT_FEED,
            messageId,
            data: toJson({
                ...review,
                recommendations: review.recommendations.map((rec) => (rec.id === recommendationId ? { ...rec, applied: true } : rec)),
            }),
        });
    } catch (error) {
        console.warn(`[Liveblocks] could not mark recommendation applied in room ${roomId}:`, error);
    }
};
