import { Router } from "express";
import authenticate from "../middleware/authenticate";
import { aiGenerateLimiter, protectedApiLimiter } from "../config/ratelimiter";
import { createRunTokenHandler, startDesignHandler, startSpecHandler } from "../controllers/ai.controller";

export const aiRoutes = Router();

// prefix : /ai

aiRoutes.use(authenticate);

aiRoutes.post("/design", aiGenerateLimiter, startDesignHandler);
aiRoutes.post("/spec", aiGenerateLimiter, startSpecHandler);
aiRoutes.post("/runs/:runId/token", protectedApiLimiter, createRunTokenHandler);
