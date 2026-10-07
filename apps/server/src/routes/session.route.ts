import { Router } from "express";
import authenticate from "../middleware/authenticate";
import { protectedApiLimiter } from "../config/ratelimiter";
import { deleteSessionHandler, getSessionHandler } from "../controllers/session.controller";

export const sessionRoutes = Router();

sessionRoutes.use(authenticate, protectedApiLimiter);

sessionRoutes.get("/", getSessionHandler);
sessionRoutes.delete("/:id", deleteSessionHandler);
