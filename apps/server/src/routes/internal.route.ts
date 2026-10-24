import express, { Router, type NextFunction, type Request, type Response } from "express";
import * as Y from "yjs";
import { z } from "zod";
import { AI_CHAT_FEED, AI_STATUS_FEED } from "@repo/types";
import { internalAuth } from "../middleware/internalAuth";
import { roomManager } from "../realtime/roomManager";
import { ok } from "../utils/api/apiEnvelope";
import { BAD_REQUEST, NOT_FOUND, OK } from "../constants/http";

/*
  The Trigger.dev tasks' way into a room. Everything here sits behind INTERNAL_API_SECRET and is blocked at the
  web proxy, so only a process that holds the secret can reach it. Rooms are not "owned" by a user here: the task
  has already been authorised by the API that started it.
 */
export const internalRoutes = Router();

internalRoutes.use(internalAuth);

const badRequest = (res: Response, message: string) => res.status(BAD_REQUEST).json({ status: "error", message });

const roomIdSchema = z.string().uuid();
internalRoutes.param("id", (_req: Request, res: Response, next: NextFunction, id: string) => {
    if (!roomIdSchema.safeParse(id).success) return badRequest(res, "Invalid room id");
    next();
});

const feedSchema = z.enum([AI_CHAT_FEED, AI_STATUS_FEED]);
const createMessageSchema = z.object({
    feed: feedSchema,
    data: z.record(z.string(), z.unknown()),
    customId: z.string().uuid().optional(),
});
const updateMessageSchema = z.object({ feed: feedSchema, data: z.record(z.string(), z.unknown()) });
const presenceSchemaBody = z.object({
    cursor: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
    thinking: z.boolean(),
    ttl: z.number().positive().max(300).optional(),
});

// GET /internal/rooms/:id/state
internalRoutes.get("/rooms/:id/state", async (req, res, next) => {
    try {
        const room = await roomManager.getOrCreateRoom(req.params.id);
        const update = Y.encodeStateAsUpdate(room.doc);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Length", update.byteLength);
        res.status(OK).send(Buffer.from(update));
    } catch (err) {
        next(err);
    }
});

// POST /internal/rooms/:id/update
internalRoutes.post(
    "/rooms/:id/update",
    express.raw({ type: "application/octet-stream", limit: "5mb" }),
    async (req, res, next) => {
        try {
            if (!Buffer.isBuffer(req.body)) return badRequest(res, "Expected a binary Yjs update");

            const room = await roomManager.getOrCreateRoom(req.params.id);
            // 2 bytes is an empty Yjs update: nothing to apply.
            if (req.body.byteLength > 2) {
                try {
                    Y.applyUpdate(room.doc, new Uint8Array(req.body), "ai");
                } catch {
                    return badRequest(res, "Malformed Yjs update");
                }
            }

            res.status(OK).json(ok({ applied: true }));
        } catch (err) {
            next(err);
        }
    }
);

// GET /internal/rooms/:id/messages?feed=&limit=
internalRoutes.get("/rooms/:id/messages", async (req, res, next) => {
    try {
        const feed = feedSchema.safeParse(req.query.feed);
        if (!feed.success) return badRequest(res, "Unknown feed");
        const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

        const room = await roomManager.getOrCreateRoom(req.params.id);
        res.status(OK).json(ok(await room.feeds.listFeedMessages(feed.data, limit)));
    } catch (err) {
        next(err);
    }
});

// POST /internal/rooms/:id/messages
internalRoutes.post("/rooms/:id/messages", express.json(), async (req, res, next) => {
    try {
        const body = createMessageSchema.safeParse(req.body);
        if (!body.success) return badRequest(res, "Invalid message");

        const room = await roomManager.getOrCreateRoom(req.params.id);
        const message = await room.feeds.createMessage(body.data.feed, body.data.data, body.data.customId);
        if (!message) return res.status(500).json({ status: "error", message: "Could not save the message" });

        res.status(OK).json(ok(message));
    } catch (err) {
        next(err);
    }
});

// PATCH /internal/rooms/:id/messages/:mid
internalRoutes.patch("/rooms/:id/messages/:mid", express.json(), async (req, res, next) => {
    try {
        const body = updateMessageSchema.safeParse(req.body);
        if (!body.success || !z.string().uuid().safeParse(req.params.mid).success) return badRequest(res, "Invalid message");

        const room = await roomManager.getOrCreateRoom(req.params.id);
        const message = await room.feeds.updateMessage(body.data.feed, req.params.mid, body.data.data);
        if (!message) return res.status(NOT_FOUND).json({ status: "error", message: "Message not found" });

        res.status(OK).json(ok(message));
    } catch (err) {
        next(err);
    }
});

// POST /internal/rooms/:id/presence
internalRoutes.post("/rooms/:id/presence", express.json(), async (req, res, next) => {
    try {
        const body = presenceSchemaBody.safeParse(req.body);
        if (!body.success) return badRequest(res, "Invalid presence");

        const room = await roomManager.getOrCreateRoom(req.params.id);
        room.presence.setAiPresence({ cursor: body.data.cursor ?? null, thinking: body.data.thinking }, body.data.ttl);

        res.status(OK).json(ok({ success: true }));
    } catch (err) {
        next(err);
    }
});
