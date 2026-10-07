import { Liveblocks, LiveblocksError } from "@liveblocks/node";
import { AI_CHAT_FEED, AI_STATUS_FEED, type AiStatusPayload, type ChatMessagePayload } from "@repo/types";
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

export const publishAssistantMessage = async (roomId: string, content: string) => {
    const message: ChatMessagePayload = {
        type: "chat",
        role: "assistant",
        content,
        sender: { id: AI_PARTICIPANT.id, name: AI_PARTICIPANT.name, color: AI_PARTICIPANT.color },
    };
    try {
        await liveblocks.createFeedMessage({ roomId, feedId: AI_CHAT_FEED, data: message });
    } catch (error) {
        console.warn(`[Liveblocks] chat publish failed for room ${roomId}:`, error);
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
