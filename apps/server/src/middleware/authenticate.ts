import appAssert from "../utils/errors/appAssert";
import { UNAUTHORIZED } from "../constants/http";
import { appErrorCode } from "../constants/appErrorCode";
import { verifyToken } from "../utils/auth/jwt";
import { orm } from "../prisma/db";
import { AccessTokenPayload } from "../types/auth.types";
import { catchError } from "../utils/errors/catchError";
import { cache, sessionCacheKey } from "../utils/cache";

/*
  A valid signature only proves the token was issued, not that its session is still alive. Without
  the session lookup, logout, password reset, password change and "sign out this device" left the
  access token working for up to its full 15 minutes. The signature is checked first, so forged or
  malformed tokens never reach the database.
 */
/*
  A confirmed-active session is remembered for 60 seconds, so most authenticated requests skip the
  Postgres lookup. Every revocation path goes through `revokeSessions`, which clears this key; the short
  TTL bounds the one race that remains (a request that read Postgres just before a revocation writing
  `1` just after it). With Redis unavailable the cache reads as a miss and every request checks Postgres
  — it fails closed, never open.
 */
const SESSION_CACHE_TTL_SECONDS = 60;

const assertSessionActive = async (sessionId: AccessTokenPayload["sessionId"]) => {
    const key = sessionCacheKey(sessionId);
    if (await cache.get(key)) return;

    const session = await orm.Session.
    where({id : sessionId}).
    where((s) => s.expiresAt.gt(new Date().toISOString())).
    select("id").
    first();
    appAssert(session, UNAUTHORIZED, "Session expired", appErrorCode.InvalidAccessToken);

    void cache.set(key, "1", SESSION_CACHE_TTL_SECONDS);
};

const authenticate = catchError(async (req, _res, next) => {
    const accessToken = req.cookies.accessToken as string | undefined;
    appAssert(accessToken, UNAUTHORIZED, "Not Authorized", appErrorCode.InvalidAccessToken);

    const { error, payload } = verifyToken(accessToken);

    appAssert(
        payload,
        UNAUTHORIZED,
        error == "jwt expired" ? "Token expired" : "Invalid token",
        error == "jwt expired" ? appErrorCode.TokenExpired : appErrorCode.InvalidAccessToken
    );

    await assertSessionActive(payload.sessionId);

    req.userId = payload.userId;
    req.sessionId = payload.sessionId;
    req.role = payload.role;
    next();
});

export default authenticate;
