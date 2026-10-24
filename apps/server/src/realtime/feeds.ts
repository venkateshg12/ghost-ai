import crypto from "node:crypto";
import {
    AI_CHAT_FEED,
    AI_STATUS_FEED,
    chatMessagePayloadSchema,
    type FeedMessage,
    type ServerFrame,
} from "@repo/types";
import { orm } from "../prisma/db";
import type { Connection } from "./connection";

const MAX_FEED_RETENTION = 200;
// A browser-written message is a chat line, not a document.
const MAX_USER_MESSAGE_CHARS = 4_000;

/** What a Room and the AI helpers use from a feed store. Postgres implements it; tests use a fake. */
export interface RoomFeeds {
    getRecentMessages(limit?: number): Promise<Record<string, FeedMessage[]>>;
    listFeedMessages(feed: string, limit?: number): Promise<FeedMessage[]>;
    createMessage(feed: string, data: unknown, customId?: string): Promise<FeedMessage | null>;
    updateMessage(feed: string, id: string, data: unknown): Promise<FeedMessage | null>;
    onClientFeedCreate(conn: Connection, feed: string, data: unknown): Promise<boolean>;
}

export class RoomFeedManager implements RoomFeeds {
    constructor(
        private readonly roomId: string,
        private readonly broadcast: (frame: ServerFrame) => void
    ) {}

    async getRecentMessages(limit = 100): Promise<Record<string, FeedMessage[]>> {
        try {
            const rows = await orm.RoomMessage
                .where({ projectId: this.roomId })
                .orderBy((m) => m.createdAt.asc())
                .all();

            const result: Record<string, FeedMessage[]> = {
                [AI_CHAT_FEED]: [],
                [AI_STATUS_FEED]: [],
            };

            for (const row of rows) {
                const list = result[row.feed] ?? (result[row.feed] = []);
                list.push({
                    id: row.id,
                    data: row.data,
                    createdAt: row.createdAt,
                });
            }

            if (result[AI_CHAT_FEED] && result[AI_CHAT_FEED].length > limit) {
                result[AI_CHAT_FEED] = result[AI_CHAT_FEED].slice(-limit);
            }
            if (result[AI_STATUS_FEED] && result[AI_STATUS_FEED].length > limit) {
                result[AI_STATUS_FEED] = result[AI_STATUS_FEED].slice(-limit);
            }

            return result;
        } catch (error) {
            console.warn(`[RoomFeedManager:${this.roomId}] getRecentMessages failed:`, error);
            return { [AI_CHAT_FEED]: [], [AI_STATUS_FEED]: [] };
        }
    }

    async listFeedMessages(feed: string, limit = 50): Promise<FeedMessage[]> {
        try {
            const rows = await orm.RoomMessage
                .where({ projectId: this.roomId, feed })
                .orderBy((m) => m.createdAt.asc())
                .all();

            const messages = rows.map((row) => ({
                id: row.id,
                data: row.data,
                createdAt: row.createdAt,
            }));

            return messages.slice(-limit);
        } catch (error) {
            console.warn(`[RoomFeedManager:${this.roomId}] listFeedMessages failed:`, error);
            return [];
        }
    }

    async createMessage(
        feed: string,
        data: unknown,
        customId?: string
    ): Promise<FeedMessage | null> {
        try {
            const id = customId ?? crypto.randomUUID();
            const cleanData = JSON.parse(JSON.stringify(data));

            const row = await orm.RoomMessage.create({
                id,
                projectId: this.roomId,
                feed,
                data: cleanData,
            });

            const message: FeedMessage = {
                id: row.id,
                data: cleanData,
                createdAt: row.createdAt,
            };

            this.broadcast({
                t: "feed:create",
                feed,
                message,
            });

            // Enforce retention cap asynchronously
            this.trimRetention(feed).catch(() => {});

            return message;
        } catch (error) {
            console.warn(`[RoomFeedManager:${this.roomId}] createMessage failed:`, error);
            return null;
        }
    }

    async updateMessage(
        feed: string,
        id: string,
        data: unknown
    ): Promise<FeedMessage | null> {
        try {
            const cleanData = JSON.parse(JSON.stringify(data));
            const existing = await orm.RoomMessage.where({ id, projectId: this.roomId, feed }).first();
            if (!existing) return null;

            const updated = await orm.RoomMessage.where({ id }).update({
                data: cleanData,
                updatedAt: new Date().toISOString(),
            });
            if (!updated) return null;

            const message: FeedMessage = {
                id: updated.id,
                data: cleanData,
                createdAt: updated.createdAt,
            };


            this.broadcast({
                t: "feed:update",
                feed,
                message,
            });

            return message;
        } catch (error) {
            console.warn(`[RoomFeedManager:${this.roomId}] updateMessage failed:`, error);
            return null;
        }
    }

    async onClientFeedCreate(
        conn: Connection,
        feed: string,
        data: unknown
    ): Promise<boolean> {
        // Clients can only post to AI_CHAT_FEED
        if (feed !== AI_CHAT_FEED) return false;

        const parsed = chatMessagePayloadSchema.safeParse(data);
        if (!parsed.success) return false;

        // Browsers can never write as assistant
        if (parsed.data.role !== "user") return false;
        if (parsed.data.content.length > MAX_USER_MESSAGE_CHARS) return false;

        // Only the text is taken from the client. Run ids, undo flags, suggestions and the sender are the
        // server's to set, so a browser cannot dress a message up as an AI result or as another person.
        const payload = {
            type: "chat" as const,
            role: "user" as const,
            content: parsed.data.content,
            sender: {
                id: conn.userId,
                name: conn.userInfo.name,
                color: conn.userInfo.color,
                ...(conn.userInfo.avatar ? { avatar: conn.userInfo.avatar } : {}),
            },
        };

        const result = await this.createMessage(feed, payload);
        return Boolean(result);
    }

    private async trimRetention(feed: string) {
        try {
            const rows = await orm.RoomMessage
                .where({ projectId: this.roomId, feed })
                .orderBy((m) => m.createdAt.asc())
                .select("id")
                .all();

            if (rows.length > MAX_FEED_RETENTION) {
                const toDelete = rows.slice(0, rows.length - MAX_FEED_RETENTION);
                for (const row of toDelete) {
                    await orm.RoomMessage.where({ id: row.id }).delete();
                }
            }
        } catch (error) {
            console.warn(`[RoomFeedManager:${this.roomId}] trimRetention failed:`, error);
        }
    }
}
