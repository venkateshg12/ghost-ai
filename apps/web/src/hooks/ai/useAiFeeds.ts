"use client";

import { useMemo } from "react";
import type { JsonObject } from "@liveblocks/client";
import { useCreateFeedMessage, useFeedMessages } from "@liveblocks/react/suspense";
import {
  AI_CHAT_FEED,
  AI_STATUS_FEED,
  aiStatusPayloadSchema,
  chatMessagePayloadSchema,
  type AiStatusPayload,
  type ChatMessagePayload,
} from "@repo/types";

export interface ChatMessage extends ChatMessagePayload {
  id: string;
  createdAt: number;
}

export interface StatusMessage extends AiStatusPayload {
  id: string;
  createdAt: number;
}

// A status that claims to be in progress but hasn't moved for this long is a run that died without
// reporting — it must not lock everyone's input forever.
const STALE_STATUS_MS = 3 * 60 * 1000;
const ACTIVE_STEPS = new Set<AiStatusPayload["step"]>(["queued", "start", "processing"]);

/*
  The room's two feeds. Every message is validated against the shared schema before it is rendered;
  anything else in the feed is ignored. Chat is the conversation (everyone's messages plus Ghost AI's
  replies); status carries only the latest progress of whatever AI run is happening in the room.
 */
export const useAiFeeds = () => {
  const { messages: chatFeed } = useFeedMessages(AI_CHAT_FEED);
  const { messages: statusFeed } = useFeedMessages(AI_STATUS_FEED);
  const createFeedMessage = useCreateFeedMessage();

  const chat = useMemo<ChatMessage[]>(
    () =>
      chatFeed
        .flatMap((message) => {
          const parsed = chatMessagePayloadSchema.safeParse(message.data);
          return parsed.success ? [{ ...parsed.data, id: message.id, createdAt: message.createdAt }] : [];
        })
        .sort((a, b) => a.createdAt - b.createdAt),
    [chatFeed]
  );

  const latestStatus = useMemo<StatusMessage | null>(() => {
    let latest: StatusMessage | null = null;
    for (const message of statusFeed) {
      const parsed = aiStatusPayloadSchema.safeParse(message.data);
      if (parsed.success && (!latest || message.createdAt > latest.createdAt)) {
        latest = { ...parsed.data, id: message.id, createdAt: message.createdAt };
      }
    }
    return latest;
  }, [statusFeed]);

  const isRoomGenerating = Boolean(
    latestStatus && ACTIVE_STEPS.has(latestStatus.step) && Date.now() - latestStatus.createdAt < STALE_STATUS_MS
  );

  // Round-tripped through JSON so optional fields that are `undefined` are dropped, not sent.
  const sendChatMessage = (message: ChatMessagePayload) =>
    createFeedMessage(AI_CHAT_FEED, JSON.parse(JSON.stringify(message)) as JsonObject);

  return { chat, latestStatus, isRoomGenerating, sendChatMessage };
};
