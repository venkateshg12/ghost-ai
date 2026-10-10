import express, { Router, type RequestHandler } from "express";
import { IMAGE_MAX_BYTES, IMAGE_TYPES } from "@repo/types";
import { PAYLOAD_TOO_LARGE } from "../constants/http";
import { AppError } from "../utils/errors/appError";
import authenticate from "../middleware/authenticate";
import { aiGenerateLimiter, protectedApiLimiter } from "../config/ratelimiter";
import {
    applyFixHandler,
    cancelRunHandler,
    createRunTokenHandler,
    getUsageHandler,
    revertRunHandler,
    startDesignHandler,
    startImageDesignHandler,
    startReviewHandler,
    startSpecHandler,
} from "../controllers/ai.controller";

export const aiRoutes = Router();

// prefix : /ai

aiRoutes.use(authenticate);

/*
  The image is the request body, read as raw bytes, and only for the three raster types: an SVG or any other
  content type is simply not parsed, which the controller rejects. Authentication has already run, so an
  anonymous client cannot make the server buffer a body. body-parser reports an oversized body as its own
  error type, which would otherwise surface as a 500.
 */
export const imageBody: RequestHandler = (req, res, next) =>
    express.raw({ type: [...IMAGE_TYPES], limit: IMAGE_MAX_BYTES })(req, res, (error?: unknown) => {
        if ((error as { type?: string } | undefined)?.type === "entity.too.large") {
            return next(new AppError(PAYLOAD_TOO_LARGE, "That image is larger than 4 MB"));
        }
        next(error);
    });

// Build and Ask both start here; the request's `mode` picks the task.
aiRoutes.post("/design", aiGenerateLimiter, startDesignHandler);
aiRoutes.post("/spec", aiGenerateLimiter, startSpecHandler);
aiRoutes.post("/design-from-image", aiGenerateLimiter, imageBody, startImageDesignHandler);
aiRoutes.post("/review", aiGenerateLimiter, startReviewHandler);
aiRoutes.post("/review/apply", protectedApiLimiter, applyFixHandler);
aiRoutes.post("/runs/:runId/token", protectedApiLimiter, createRunTokenHandler);
aiRoutes.post("/runs/:runId/cancel", protectedApiLimiter, cancelRunHandler);
aiRoutes.post("/runs/:runId/revert", protectedApiLimiter, revertRunHandler);
aiRoutes.get("/usage/:projectId", protectedApiLimiter, getUsageHandler);
