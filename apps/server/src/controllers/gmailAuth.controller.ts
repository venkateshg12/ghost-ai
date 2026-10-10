import crypto from "node:crypto";
import { CookieOptions } from "express";
import { NODE_ENV } from "../constants/env";
import { BAD_REQUEST, OK } from "../constants/http";
import { exchangeGmailAuthCode, getGmailAuthUrl, sendEmail } from "../services/gmail.service";
import { ok } from "../utils/api";
import { appAssert, catchError } from "../utils/errors";

const STATE_COOKIE = "gmail_oauth_state";

// Scoped to this flow's path. Lax is enough: Google returns the browser with a top-level GET.
const stateCookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: NODE_ENV !== "development",
    path: "/api/auth/gmail",
};

const sameValue = (a: string, b: string) =>
    crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());

// GET /api/auth/gmail — send the browser to Google's consent screen.
export const gmailAuthorizeHandler = catchError(async (_req, res) => {
    // A random state tied to this browser stops someone else's authorization from being replayed here.
    const state = crypto.randomBytes(32).toString("hex");
    res.cookie(STATE_COOKIE, state, { ...stateCookieOptions, maxAge: 10 * 60 * 1000 });

    console.log("[gmail] OAuth authorization started");
    res.redirect(getGmailAuthUrl(state));
});

// GET /api/auth/gmail/callback — Google sends the browser back here with a one-time code.
export const gmailCallbackHandler = catchError(async (req, res) => {
    const { code, state, error } = req.query;
    const expectedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, stateCookieOptions);

    appAssert(!error, BAD_REQUEST, "Google authorization was denied or failed; start again at /api/auth/gmail");
    appAssert(
        typeof state === "string" && typeof expectedState === "string" && sameValue(state, expectedState),
        BAD_REQUEST,
        "Invalid or expired authorization session; start again at /api/auth/gmail"
    );
    appAssert(typeof code === "string" && code.length > 0, BAD_REQUEST, "Missing authorization code");

    const refreshToken = await exchangeGmailAuthCode(code);

    /*
      The one place the refresh token is shown: the server console, for the person running the setup.
      It is never put in the response, and nothing else in the app logs it.
     */
    console.log("[gmail] Authorization successful. Add this to your .env, then restart the server:");
    console.log(`GMAIL_REFRESH_TOKEN=${refreshToken}`);

    res.status(OK).type("html").send(
        "<p>Gmail authorization successful. You can now configure GMAIL_REFRESH_TOKEN (see the server console).</p>"
    );
});

// POST /api/auth/gmail/test — admin-only, development-only smoke test of sendEmail.
export const gmailTestHandler = catchError(async (req, res) => {
    const { messageId } = await sendEmail(req.body);
    res.status(OK).json(ok({ messageId }));
});
