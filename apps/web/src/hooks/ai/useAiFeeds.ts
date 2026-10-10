"use client";

import { useMemo } from "react";
import type { JsonObject } from "@liveblocks/client";
import {
  useCreateFeedMessage,
  useFeedMessages,
} from "@liveblocks/react/suspense";
import {
  AI_CHAT_FEED,
  AI_STATUS_FEED,
  aiStatusPayloadSchema,
  chatMessagePayloadSchema,
  reviewPayloadSchema,
  type AiStatusPayload,
  type ChatMessagePayload,
  type ReviewPayload,
} from "@repo/types";

export interface ChatMessage extends ChatMessagePayload {
  id: string;
  createdAt: number;
}

export interface ReviewMessage extends ReviewPayload {
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
// A reply still marked "streaming" this long after it began belongs to a run that died mid-answer: stop
// showing a typing caret for it.
const STALE_STREAM_MS = 3 * 60 * 1000;
const ACTIVE_STEPS = new Set<AiStatusPayload["step"]>([
  "queued",
  "start",
  "processing",
]);

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
          if (!parsed.success) return [];
          const streaming =
            Boolean(parsed.data.streaming) &&
            Date.now() - message.createdAt < STALE_STREAM_MS;
          return [
            {
              ...parsed.data,
              streaming,
              id: message.id,
              createdAt: message.createdAt,
            },
          ];
        })
        .sort((a, b) => a.createdAt - b.createdAt),
    [chatFeed],
  );

  // Reviews share the chat feed but are not conversation: they feed the Review tab.
  const latestReview = useMemo<ReviewMessage | null>(() => {
    let latest: ReviewMessage | null = null;
    for (const message of chatFeed) {
      const parsed = reviewPayloadSchema.safeParse(message.data);
      if (parsed.success && (!latest || message.createdAt > latest.createdAt)) {
        latest = {
          ...parsed.data,
          id: message.id,
          createdAt: message.createdAt,
        };
      }
    }
    return latest;
  }, [chatFeed]);

  const latestStatus = useMemo<StatusMessage | null>(() => {
    let latest: StatusMessage | null = null;
    for (const message of statusFeed) {
      const parsed = aiStatusPayloadSchema.safeParse(message.data);
      if (parsed.success && (!latest || message.createdAt > latest.createdAt)) {
        latest = {
          ...parsed.data,
          id: message.id,
          createdAt: message.createdAt,
        };
      }
    }
    return latest;
  }, [statusFeed]);

  const isRoomGenerating = Boolean(
    latestStatus &&
    ACTIVE_STEPS.has(latestStatus.step) &&
    Date.now() - latestStatus.createdAt < STALE_STATUS_MS,
  );

  // Round-tripped through JSON so optional fields that are `undefined` are dropped, not sent.
  const sendChatMessage = (message: ChatMessagePayload) =>
    createFeedMessage(
      AI_CHAT_FEED,
      JSON.parse(JSON.stringify(message)) as JsonObject,
    );

  return {
    chat,
    latestReview,
    latestStatus,
    isRoomGenerating,
    sendChatMessage,
  };
};
