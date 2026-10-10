import { Router } from "express";
import { gmailAuthorizeHandler, gmailCallbackHandler, gmailTestHandler } from "../controllers/gmailAuth.controller";
import authenticate from "../middleware/authenticate";
import requireAdmin from "../middleware/requireAdmin";
import { protectedApiLimiter } from "../config/ratelimiter";
import { GMAIL_OAUTH_SETUP, NODE_ENV } from "../constants/env";

export const gmailRoutes = Router();

// prefix : /api/auth/gmail

/*
  The one-time authorization flow. Anyone who can open it can park a Gmail refresh token in the
  server log, so in production it is off unless GMAIL_OAUTH_SETUP=true (set it only while
  re-authorizing, e.g. when a Google "Testing" token expires after 7 days).
 */
if (NODE_ENV !== "production" || GMAIL_OAUTH_SETUP === "true") {
    gmailRoutes.get("/", gmailAuthorizeHandler);
    gmailRoutes.get("/callback", gmailCallbackHandler);
}

// An endpoint that sends mail to any address is never mounted in production.
if (NODE_ENV !== "production") {
    gmailRoutes.post("/test", authenticate, requireAdmin, protectedApiLimiter, gmailTestHandler);
}
