import { Router } from "express";
import authenticate from "../middleware/authenticate";
import { protectedApiLimiter } from "../config/ratelimiter";
import { getRealtimeTicketHandler } from "../controllers/realtime.controller";

export const realtimeRoutes = Router();

// prefix: /realtime
realtimeRoutes.use(authenticate, protectedApiLimiter);

realtimeRoutes.post("/ticket", getRealtimeTicketHandler);
