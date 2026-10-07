import crypto from "crypto";
import { ChangePasswordSchema, CredentialSchema, LoginInSchema, UpdateProfileSchema } from "@repo/types";
import { orm } from "../prisma/db";
import type { Models } from "../prisma/contract";
import appAssert from "../utils/errors/appAssert";
import { BAD_REQUEST, CONFLICT, NOT_FOUND, UNAUTHORIZED } from "../constants/http";
import { compareValue, hashValue } from "../utils/auth/bcrypt";
import { omitPassword } from "../utils/auth/omitPassword";
import { VerificationLinkType } from "../constants/verificationLinkType";
import { createVerificationToken, hashVerificationToken } from "../utils/auth/verificationToken";
import { tenMinutesFromNow, thirtyDaysFromNow } from "../utils/date/date";
import { refreshTokenSignOptions, refreshTokenVerifyOptions, signToken, verifyToken } from "../utils/auth/jwt";
import { RefreshTokenPayload } from "../types/auth.types";
import { appErrorCode } from "../constants/appErrorCode";
import { CLIENT_URL, NODE_ENV } from "../constants/env";
import { EmailProducer } from "../jobs/producers/email.producer";
import { cache, sessionCacheKey } from "../utils/cache";


const dummyPasswordHash = hashValue(crypto.randomBytes(32).toString("hex"));

const REFRESH_REUSE_GRACE_MS = 30 * 1000;

const GENERIC_RESEND_MESSAGE =
    "If that account exists and is not yet verified, a new verification link has been sent.";


const issueEmailVerificationLink = async (user: Pick<Models.public_User, "id" | "email" | "verified">) => {
    // Delete any existing verification link for this user & type
    await orm.VerificationLink
        .where({
            userId: user.id,
            type: VerificationLinkType.EmailVerification,
        })
        .deleteAll();

    // Create a new verification token & save hashed token to Postgres
    const { token, tokenHash } = createVerificationToken();
    await orm.VerificationLink.create({
        userId: user.id,
        type: VerificationLinkType.EmailVerification,
        token: tokenHash,
        expiresAt: tenMinutesFromNow().toISOString(),
    });

    await EmailProducer.sendVerifyMail({ userId: user.id, email: user.email, verificationToken: token });

    if (NODE_ENV === "development") {
        console.log(`[dev] verify link for ${user.email}: ${CLIENT_URL}/auth/verify/${token}`);
    }
};

type SessionUser = Pick<Models.public_User, "id" | "role">;

const signAccessToken = (user: SessionUser, sessionId: Models.public_Session["id"]) =>
    signToken({
        userId: user.id,
        role: user.role,
        sessionId
    });

const signRefreshToken = (sessionId: Models.public_Session["id"], jti: string) =>
    signToken({ sessionId, jti }, refreshTokenSignOptions);

export const createSessionAndTokens = async (user: SessionUser, userAgent?: string) => {
    const refreshJti = crypto.randomUUID();

    const session = await orm.Session.
        create({
            userId: user.id,
            userAgent,
            refreshJti
        });

    return {
        accessToken: signAccessToken(user, session.id),
        refreshToken: signRefreshToken(session.id, refreshJti)
    }
}


// The one path that ends sessions. `exceptSessionId` exists because the filter only takes the
// equality form of `.where`, so "all of this user's sessions but the current one" can't be expressed
// as a filter.
export const revokeSessions = async (
    filter: Parameters<typeof orm.Session.where>[0],
    exceptSessionId?: Models.public_Session["id"]
) => {

    let query = orm.Session.where(filter);
    if (exceptSessionId) {
        query = query.where((s) => s.id.neq(exceptSessionId));
    }

    const sessions = await query
        .select("id")
        .all();

    if (sessions.length == 0) return 0;
    const ids = sessions.map((s) => s.id);

    await orm.Session.
        where((s) => s.id.in(ids))
        .deleteAll();

    // `authenticate` remembers live sessions for 60s; drop them so the revocation takes effect now.
    await cache.del(...ids.map(sessionCacheKey));

    return ids.length;
}

export const createAccount = async (data: CredentialSchema) => {
    // verify existing user doesn't exist
    const existingUser = await orm.User
        .where({ email: data.email })
        .select("id")
        .first();
    appAssert(!existingUser, CONFLICT, "User already exists!");

    // create user
    const passwordHash = await hashValue(data.password);
    const user = await orm.User.create({
        name: data.name,
        email: data.email,
        passwordHash,
    });

    await issueEmailVerificationLink(user);

    // return user
    return { user: omitPassword(user) };
};


export const loginUser = async ({ email, password, userAgent }: LoginInSchema) => {

    const user = await orm.User.where({ email }).first();

    // validate the password from the request — against a dummy hash when there's nothing to
    // compare, so an unknown email takes as long to reject as a wrong password
    const isValid = user?.passwordHash
        ? await compareValue(password, user.passwordHash)
        : await compareValue(password, await dummyPasswordHash).then(() => false);

    appAssert(user && isValid, UNAUTHORIZED, "Invalid email or password");

    if (!user.verified) {
        await issueEmailVerificationLink(user);
        appAssert(false, UNAUTHORIZED, "you are not verified , please look into the email");
    }

    const { accessToken, refreshToken } = await createSessionAndTokens(user, userAgent);

    return {
        user: omitPassword(user),
        accessToken,
        refreshToken
    };
};


export const refreshUserAccessToken = async (refreshToken: string) => {
    const now = Date.now();
    const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, refreshTokenVerifyOptions);
    appAssert(payload && payload.jti, UNAUTHORIZED, "Invalid refresh token", appErrorCode.InvalidAccessToken);

    const session = await orm.Session
        .where({ id: payload.sessionId })
        .select("id", "userId", "expiresAt")
        .first();
    appAssert(session && new Date(session.expiresAt).getTime() > now, UNAUTHORIZED, "Session Expired!", appErrorCode.InvalidAccessToken);

    const user = await orm.User
        .where({ id: session.userId })
        .select("id", "role")
        .first();
    appAssert(user, UNAUTHORIZED, "User not found", appErrorCode.InvalidAccessToken);

    // Rotate only if the presented token is still the current one. Doing it as a conditional update
    // means two concurrent refreshes can't both rotate and leave one of them holding a dead token.
    const newJti = crypto.randomUUID();

    const rotated = await orm.Session
        .where({ id: session.id, refreshJti: payload.jti })
        .update({
            refreshJti: newJti,
            prevRefreshJti: payload.jti,
            rotatedAt: new Date(now).toISOString(),
            expiresAt: thirtyDaysFromNow().toISOString()
        });

    let currentJti: string;

    if (rotated) {
        currentJti = newJti;
    } else {
        // Lost the race, or the token is stale. Re-read to see which.
        const latest = await orm.Session
            .where({ id: session.id })
            .select("refreshJti", "prevRefreshJti", "rotatedAt")
            .first();
        const isRecentlyReplaced =
            latest?.refreshJti &&
            latest.prevRefreshJti === payload.jti &&
            latest.rotatedAt &&
            now - new Date(latest.rotatedAt).getTime() < REFRESH_REUSE_GRACE_MS;

        if (!isRecentlyReplaced) {
            await revokeSessions({ id: session.id });
            appAssert(false, UNAUTHORIZED, "Session revoked", appErrorCode.InvalidAccessToken);
        }

        currentJti = latest!.refreshJti;
    }

    return {
        accessToken: signAccessToken(user, session.id),
        newRefreshToken: signRefreshToken(session.id, currentJti)
    };
}


export const verifyEmail = async (token: string, userAgent?: string) => {
    // Atomically find and delete the token in one query to prevent double redemption
    const verificationLink = await orm.VerificationLink
        .where({
            token: hashVerificationToken(token),
            type: VerificationLinkType.EmailVerification,
        })
        .where((v) => v.expiresAt.gt(new Date().toISOString()))
        .delete();

    appAssert(verificationLink, BAD_REQUEST, "Verification link has expired or is invalid.");

    const user = await orm.User
        .where({ id: verificationLink.userId })
        .update({
            verified: true,
        });

    appAssert(user, NOT_FOUND, "User not found! Please register");

    // Invalidate any remaining email verification links for this user
    await orm.VerificationLink
        .where({
            userId: user.id,
            type: VerificationLinkType.EmailVerification,
        })
        .deleteAll();

    const { accessToken, refreshToken } = await createSessionAndTokens(user, userAgent);

    return { user: omitPassword(user), accessToken, refreshToken };
};


export const resendVerificationEmail = async (email: string) => {
    const user = await orm.User
        .where({ email })
        .select("id", "verified", "email")
        .first();

    if (user && !user.verified) {
        await issueEmailVerificationLink(user);
    }

    return { message: GENERIC_RESEND_MESSAGE };
};

export const resendVeficationEmail = resendVerificationEmail;


export const sendResetPasswordEmail = async (email: string) => {
    const genericMessage = "If an account with that email exists, a password reset link has been sent.";

    const user = await orm.User
        .where({ email })
        .select("id", "email")
        .first();

    if (!user) {
        return { message: genericMessage };
    }

    // Invalidate all existing password reset links for this user
    await orm.VerificationLink
        .where({ userId: user.id, type: VerificationLinkType.PasswordReset })
        .deleteAll();

    const { token, tokenHash } = createVerificationToken();
    await orm.VerificationLink.create({
        userId: user.id,
        type: VerificationLinkType.PasswordReset,
        token: tokenHash,
        expiresAt: tenMinutesFromNow().toISOString(),
    });

    
    await EmailProducer.sendPasswordReset({ userId: user.id, email: user.email, resetToken: token });

    if (NODE_ENV === "development") {
        console.log(`[dev] reset link for ${user.email}: ${CLIENT_URL}/password/reset/${token}`);
    }

    return { message: genericMessage };
};

export const sentResetPasswordEmail = sendResetPasswordEmail;


type ResetPasswordParams = { token: string; password: string };

export const resetPassword = async (
    tokenOrParams: string | ResetPasswordParams,
    rawPassword?: string
) => {
    const token = typeof tokenOrParams === "object" ? tokenOrParams.token : tokenOrParams;
    const password = typeof tokenOrParams === "object" ? tokenOrParams.password : rawPassword;

    appAssert(token && password, BAD_REQUEST, "Token and password are required");

    // Atomically find and consume the token so it cannot be used more than once
    const verificationLink = await orm.VerificationLink
        .where({
            token: hashVerificationToken(token),
            type: VerificationLinkType.PasswordReset,
        })
        .where((v) => v.expiresAt.gt(new Date().toISOString()))
        .delete();

    appAssert(verificationLink, BAD_REQUEST, "Invalid or expired reset link");

    const user = await orm.User
        .where({ id: verificationLink.userId })
        .select("id")
        .first();

    appAssert(user, NOT_FOUND, "User not found");

    // Hash the plain-text password before updating
    const passwordHash = await hashValue(password);
    await orm.User
        .where({ id: user.id })
        .update({ passwordHash });

    // Clean up any remaining password reset tokens for this user
    await orm.VerificationLink
        .where({
            userId: user.id,
            type: VerificationLinkType.PasswordReset,
        })
        .deleteAll();

    // Invalidate all existing user sessions
    await revokeSessions({ userId: user.id });

    return { message: "Password reset successful" };
};


export const updateProfileService = async (userId: string, data: UpdateProfileSchema) => {
    const user = await orm.User
        .where({ id: userId })
        .update({
            name: data.name,
        });

    appAssert(user, NOT_FOUND, "User not found");

    // Names appear in every share dialog this user belongs to.
    await cache.bump("members");

    return omitPassword(user);
};


export const changePasswordService = async (
    userId: string,
    currentSessionId: string,
    data: ChangePasswordSchema
) => {
    const user = await orm.User
        .where({ id: userId })
        .select("id", "authProvider", "passwordHash")
        .first();

    appAssert(user, NOT_FOUND, "User not found");
    appAssert(
        user.authProvider === "local" && user.passwordHash,
        BAD_REQUEST,
        "Password change is not available for accounts signed in with Google"
    );

    const isValid = await compareValue(data.currentPassword, user.passwordHash);
    appAssert(isValid, UNAUTHORIZED, "Current password is incorrect");

    const newPasswordHash = await hashValue(data.newPassword);
    await orm.User
        .where({ id: user.id })
        .update({ passwordHash: newPasswordHash });

    // Sign the user out of every other device/session, keep the current one active
    await revokeSessions({ userId: user.id }, currentSessionId);

    return { message: "Password changed successfully. You've been signed out of all other devices." };
};