import {
    AI_CHAT_FEED,
    AI_STATUS_FEED,
    chatMessagePayloadSchema,
    reviewPayloadSchema,
    type AiStatusPayload,
    type ChatMessagePayload,
    type ReviewPayload,
} from "@repo/types";
import { AI_PARTICIPANT, getUserColor } from "../realtime/identity";
import { getLocalRoom } from "../realtime/local";
import { internalFetch } from "../realtime/internalClient";

export { AI_PARTICIPANT, getUserColor };

type AssistantExtras = Partial<Pick<ChatMessagePayload, "streaming" | "runId" | "meta" | "suggestions" | "canUndo">>;

const toJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export const assistantPayload = (content: string, extras: AssistantExtras = {}): ChatMessagePayload => ({
    type: "chat",
    role: "assistant",
    content,
    sender: { id: AI_PARTICIPANT.id, name: AI_PARTICIPANT.name, color: AI_PARTICIPANT.color },
    ...extras,
});

export interface HistoryMessage {
    role: "user" | "assistant";
    content: string;
}

const internalJson = (endpoint: string, options: RequestInit = {}) =>
    internalFetch(endpoint, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });

export const publishStatus = async (roomId: string, status: Omit<AiStatusPayload, "type">): Promise<void> => {
    try {
        const local = await getLocalRoom(roomId);
        const data = { type: "status", ...status };
        if (local) {
            await local.feeds.createMessage(AI_STATUS_FEED, data);
            return;
        }

        await internalJson(`/internal/rooms/${roomId}/messages`, {
            method: "POST",
            body: JSON.stringify({ feed: AI_STATUS_FEED, data }),
        });
    } catch (error) {
        console.warn(`[realtime] status publish failed for room ${roomId}:`, error);
    }
};

export const publishAssistantMessage = async (
    roomId: string,
    content: string,
    extras: AssistantExtras = {}
): Promise<string | null> => {
    try {
        const payload = toJson(assistantPayload(content, extras));
        const local = await getLocalRoom(roomId);
        if (local) {
            const msg = await local.feeds.createMessage(AI_CHAT_FEED, payload);
            return msg?.id ?? null;
        }

        const res = await internalJson(`/internal/rooms/${roomId}/messages`, {
            method: "POST",
            body: JSON.stringify({ feed: AI_CHAT_FEED, data: payload }),
        });

        if (!res.ok) return null;
        const body = (await res.json()) as { data?: { id?: string } };
        return body.data?.id ?? null;
    } catch (error) {
        console.warn(`[realtime] chat publish failed for room ${roomId}:`, error);
        return null;
    }
};

export const updateAssistantMessage = async (
    roomId: string,
    messageId: string,
    content: string,
    extras: AssistantExtras = {}
): Promise<void> => {
    try {
        const payload = toJson(assistantPayload(content, extras));
        const local = await getLocalRoom(roomId);
        if (local) {
            await local.feeds.updateMessage(AI_CHAT_FEED, messageId, payload);
            return;
        }

        await internalJson(`/internal/rooms/${roomId}/messages/${messageId}`, {
            method: "PATCH",
            body: JSON.stringify({ feed: AI_CHAT_FEED, data: payload }),
        });
    } catch (error) {
        console.warn(`[realtime] chat update failed for room ${roomId}:`, error);
    }
};

export const readChatHistory = async (roomId: string, limit = 12): Promise<HistoryMessage[]> => {
    try {
        let rawMessages: { id: string; data: unknown; createdAt: string | number }[] = [];
        const local = await getLocalRoom(roomId);
        if (local) {
            rawMessages = await local.feeds.listFeedMessages(AI_CHAT_FEED, limit * 2);
        } else {
            const res = await internalJson(`/internal/rooms/${roomId}/messages?feed=${AI_CHAT_FEED}&limit=${limit * 2}`);
            if (res.ok) {
                const body = (await res.json()) as { data?: typeof rawMessages };
                rawMessages = body.data ?? [];
            }
        }

        return rawMessages
            .flatMap((message) => {
                const parsed = chatMessagePayloadSchema.safeParse(message.data);
                return parsed.success && !parsed.data.streaming ? [parsed.data] : [];
            })
            .slice(-limit)
            .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    } catch (error) {
        console.warn(`[realtime] reading chat history failed for room ${roomId}:`, error);
        return [];
    }
};

export const setAiPresence = async (
    roomId: string,
    presence: { cursor: { x: number; y: number } | null; thinking: boolean }
): Promise<void> => {
    try {
        const local = await getLocalRoom(roomId);
        const ttl = presence.thinking ? 120 : 2;
        if (local) {
            local.presence.setAiPresence(presence, ttl);
            return;
        }

        await internalJson(`/internal/rooms/${roomId}/presence`, {
            method: "POST",
            body: JSON.stringify({ cursor: presence.cursor, thinking: presence.thinking, ttl }),
        });
    } catch (error) {
        console.warn(`[realtime] AI presence update failed for room ${roomId}:`, error);
    }
};

export const markRunReverted = async (roomId: string, runId: string): Promise<void> => {
    try {
        let rawMessages: { id: string; data: unknown }[] = [];
        const local = await getLocalRoom(roomId);
        if (local) {
            rawMessages = await local.feeds.listFeedMessages(AI_CHAT_FEED, 50);
        } else {
            const res = await internalJson(`/internal/rooms/${roomId}/messages?feed=${AI_CHAT_FEED}&limit=50`);
            if (res.ok) {
                const body = (await res.json()) as { data?: typeof rawMessages };
                rawMessages = body.data ?? [];
            }
        }

        for (const message of rawMessages) {
            const parsed = chatMessagePayloadSchema.safeParse(message.data);
            if (parsed.success && parsed.data.runId === runId && parsed.data.canUndo) {
                const updated = toJson({ ...parsed.data, canUndo: false });
                if (local) {
                    await local.feeds.updateMessage(AI_CHAT_FEED, message.id, updated);
                } else {
                    await internalJson(`/internal/rooms/${roomId}/messages/${message.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ feed: AI_CHAT_FEED, data: updated }),
                    });
                }
            }
        }
    } catch (error) {
        console.warn(`[realtime] could not clear Undo for run ${runId}:`, error);
    }
};

export const publishReview = async (roomId: string, review: ReviewPayload): Promise<string | null> => {
    try {
        const payload = toJson(review);
        const local = await getLocalRoom(roomId);
        if (local) {
            const msg = await local.feeds.createMessage(AI_CHAT_FEED, payload);
            return msg?.id ?? null;
        }

        const res = await internalJson(`/internal/rooms/${roomId}/messages`, {
            method: "POST",
            body: JSON.stringify({ feed: AI_CHAT_FEED, data: payload }),
        });

        if (!res.ok) return null;
        const body = (await res.json()) as { data?: { id?: string } };
        return body.data?.id ?? null;
    } catch (error) {
        console.warn(`[realtime] review publish failed for room ${roomId}:`, error);
        return null;
    }
};

export const findReview = async (
    roomId: string,
    reviewRunId: string
): Promise<{ messageId: string; review: ReviewPayload } | null> => {
    try {
        let rawMessages: { id: string; data: unknown }[] = [];
        const local = await getLocalRoom(roomId);
        if (local) {
            rawMessages = await local.feeds.listFeedMessages(AI_CHAT_FEED, 50);
        } else {
            const res = await internalJson(`/internal/rooms/${roomId}/messages?feed=${AI_CHAT_FEED}&limit=50`);
            if (res.ok) {
                const body = (await res.json()) as { data?: typeof rawMessages };
                rawMessages = body.data ?? [];
            }
        }

        for (const message of rawMessages) {
            const parsed = reviewPayloadSchema.safeParse(message.data);
            if (parsed.success && parsed.data.runId === reviewRunId) {
                return { messageId: message.id, review: parsed.data };
            }
        }
        return null;
    } catch (error) {
        console.warn(`[realtime] findReview failed for room ${roomId}:`, error);
        return null;
    }
};

export const markRecommendationApplied = async (
    roomId: string,
    messageId: string,
    review: ReviewPayload,
    recommendationId: string
): Promise<void> => {
    try {
        const updated = toJson({
            ...review,
            recommendations: review.recommendations.map((rec) =>
                rec.id === recommendationId ? { ...rec, applied: true } : rec
            ),
        });

        const local = await getLocalRoom(roomId);
        if (local) {
            await local.feeds.updateMessage(AI_CHAT_FEED, messageId, updated);
            return;
        }

        await internalJson(`/internal/rooms/${roomId}/messages/${messageId}`, {
            method: "PATCH",
            body: JSON.stringify({ feed: AI_CHAT_FEED, data: updated }),
        });
    } catch (error) {
        console.warn(`[realtime] could not mark recommendation applied in room ${roomId}:`, error);
    }
};
