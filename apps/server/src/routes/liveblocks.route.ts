import { Router } from "express";
import authenticate from "../middleware/authenticate";
import { protectedApiLimiter } from "../config/ratelimiter";
import { liveblocksAuthHandler } from "../controllers/liveblocks.controller";

export const liveblocksRoutes = Router();

// prefix : /liveblocks

liveblocksRoutes.post("/auth", authenticate, protectedApiLimiter, liveblocksAuthHandler);
