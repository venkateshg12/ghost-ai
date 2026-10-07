import z from "zod";
import { NOT_FOUND, OK } from "../constants/http";
import { orm } from "../prisma/db";
import { catchError } from "../utils/errors/catchError";
import appAssert from "../utils/errors/appAssert";
import { ok } from "../utils/api/apiEnvelope";
import { revokeSessions } from "../services/auth.service";

const sessionIdSchema = z.string().uuid({ message: "Invalid session id" });


export const getSessionHandler = catchError(
    async (req, res) => {
        const sessions = await orm.Session
            .where({ userId: req.userId })
            .where((s) => s.expiresAt.gt(new Date().toISOString()))
            .select("id", "userAgent", "createdAt")
            .orderBy((s) => s.createdAt.desc())
            .all();

        return res.status(OK).json(
            ok(sessions.map((session) => ({
                ...session,
                isCurrent: session.id === req.sessionId,
            })))
        );
    }
);

export const deleteSessionHandler = catchError(
    async (req, res) => {
        const sessionId = sessionIdSchema.parse(req.params.id);
        const revoked = await revokeSessions({
            id: sessionId,
            userId: req.userId,
        });
        appAssert(revoked, NOT_FOUND, "Session not found");
        return res.status(OK).json(ok({ message: "Session removed" }));
    }
);