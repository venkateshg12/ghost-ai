import { z } from "zod";
import { AI_CHAT_FEED, chatMessagePayloadSchema } from "./ai";

export const FRAME = {
    SYNC_STEP1: 0,
    SYNC_STEP2: 1,
    UPDATE: 2,
} as const;

export type FrameType = (typeof FRAME)[keyof typeof FRAME];

export const encodeBinaryFrame = (type: FrameType, payload: Uint8Array): Uint8Array => {
    const frame = new Uint8Array(1 + payload.byteLength);
    frame[0] = type;
    frame.set(payload, 1);
    return frame;
};

export const decodeBinaryFrame = (frame: Uint8Array): { type: FrameType; payload: Uint8Array } => {
    const type = frame[0] as FrameType;
    const payload = frame.subarray(1);
    return { type, payload };
};

export const CLOSE = {
    UNAUTHORIZED: 4401, // missing, expired or reused ticket
    FORBIDDEN: 4403, // no access to the project (or removed)
    ROOM_DELETED: 4410, // room or project was deleted
    TOO_LARGE: 4413, // frame or document limits exceeded
    RATE_LIMITED: 4429, // rate limit on socket exceeded
} as const;

export type CloseCode = (typeof CLOSE)[keyof typeof CLOSE];

export const REALTIME_LIMITS = {
    maxFrameBytes: 1_000_000,
    maxNodes: 500,
    maxEdges: 1_000,
    presenceIntervalMs: 50,
    heartbeatMs: 25_000,
    ticketTtlSeconds: 60,
    maxConnectionsPerUser: 10,
} as const;

export const presenceSchema = z.object({
    cursor: z.object({ x: z.number(), y: z.number() }).nullable(),
    thinking: z.boolean(),
});
export type Presence = z.infer<typeof presenceSchema>;

export const realtimeUserInfoSchema = z.object({
    name: z.string(),
    avatar: z.string().nullable().optional(),
    color: z.string(),
});
export type RealtimeUserInfo = z.infer<typeof realtimeUserInfoSchema>;

export const serverPresenceChangeSchema = z.object({
    connectionId: z.string(),
    userId: z.string(),
    info: realtimeUserInfoSchema,
    presence: presenceSchema,
});
export type ServerPresenceChange = z.infer<typeof serverPresenceChangeSchema>;

export const clientFrameSchema = z.discriminatedUnion("t", [
    z.object({ t: z.literal("presence"), presence: presenceSchema }),
    z.object({ t: z.literal("feed:create"), feed: z.enum([AI_CHAT_FEED]), data: chatMessagePayloadSchema }),
    z.object({ t: z.literal("flush") }),
]);
export type ClientFrame = z.infer<typeof clientFrameSchema>;

export const feedMessageSchema = z.object({
    id: z.string(),
    data: z.unknown(),
    createdAt: z.union([z.string(), z.number()]),
});
export type FeedMessage = z.infer<typeof feedMessageSchema>;

export const serverFrameSchema = z.discriminatedUnion("t", [
    z.object({
        t: z.literal("hello"),
        connectionId: z.string(),
        presence: z.array(serverPresenceChangeSchema),
        messages: z.record(z.string(), z.array(feedMessageSchema)).optional(),
    }),
    z.object({
        t: z.literal("presence:batch"),
        changes: z.array(serverPresenceChangeSchema),
    }),
    z.object({
        t: z.literal("presence:leave"),
        connectionId: z.string(),
    }),
    z.object({
        t: z.literal("feed:create"),
        feed: z.string(),
        message: feedMessageSchema,
    }),
    z.object({
        t: z.literal("feed:update"),
        feed: z.string(),
        message: feedMessageSchema,
    }),
    z.object({
        t: z.literal("saved"),
        timestamp: z.number(),
    }),
    z.object({
        t: z.literal("error"),
        code: z.number(),
        message: z.string(),
    }),
]);
export type ServerFrame = z.infer<typeof serverFrameSchema>;

export const createTicketRequestSchema = z.object({
    roomId: z.string().uuid(),
});
export type CreateTicketRequest = z.infer<typeof createTicketRequestSchema>;

export const ticketResponseSchema = z.object({
    ticket: z.string(),
    url: z.string(),
});
export type TicketResponse = z.infer<typeof ticketResponseSchema>;
