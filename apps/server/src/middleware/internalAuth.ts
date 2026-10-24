import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { INTERNAL_API_SECRET } from "../constants/env";
import { UNAUTHORIZED } from "../constants/http";

/**
 * Constant-time bearer token check against INTERNAL_API_SECRET.
 * Used for Trigger.dev task calls and internal room access.
 */
export const internalAuth: RequestHandler = (req, res, next) => {
    const authHeader = req.headers.authorization ?? "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        res.status(UNAUTHORIZED).json({
            status: "error",
            message: "Internal authorization required",
        });
        return;
    }

    const a = crypto.createHash("sha256").update(token).digest();
    const b = crypto.createHash("sha256").update(INTERNAL_API_SECRET).digest();

    if (!crypto.timingSafeEqual(a, b)) {
        res.status(UNAUTHORIZED).json({
            status: "error",
            message: "Invalid internal authorization token",
        });
        return;
    }

    next();
};
