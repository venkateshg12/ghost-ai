import z from "zod";
import { GOOGLE_CLIENT_ID } from "../constants/env";
import { LoginTicket, OAuth2Client } from "google-auth-library";
import { catchError } from "../utils/errors/catchError";
import { INTERNAL_SERVER_ERROR, OK, UNAUTHORIZED } from "../constants/http";
import appAssert from "../utils/errors/appAssert";
import { orm } from "../prisma/db";
import { createSessionAndTokens, revokeSessions } from "../services/auth.service";
import { setAuthCookies } from "../utils/auth/cookie";
import { ok } from "../utils/api/apiEnvelope";
import { omitPassword } from "../utils/auth/omitPassword";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const googleAuthSchema = z.object({ idToken: z.string().min(1) });

export const googleAuthHandler = catchError(async (req, res) => {
    const { idToken } = googleAuthSchema.parse(req.body);
    appAssert(GOOGLE_CLIENT_ID, INTERNAL_SERVER_ERROR, "Google Client ID is not configured on the server");

    let ticket: LoginTicket | undefined;
    try {
        ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
    } catch (err: any) {
        console.error("Google Auth token verification failed:", err);
        appAssert(false, UNAUTHORIZED, "Invalid Google ID token");
    }

    const payload = ticket.getPayload();
    appAssert(payload, UNAUTHORIZED, "Invalid token payload");

    const { email: rawEmail, email_verified, name, sub: googleId, picture: avatar } = payload;
    appAssert(rawEmail && email_verified, UNAUTHORIZED, "Unverified Google account or email missing");
    const email = rawEmail.trim().toLowerCase();

    // Find existing user by email
    let user = await orm.User.where({ email }).first();

    if (user) {
        /*
          An unverified local account was never proven to belong to this email's owner — anyone
          can register someone else's address. Google has now proven ownership, so the account is
          taken over by its rightful owner: the unproven password is dropped, and any sessions or
          pending links created under it are revoked. Otherwise whoever pre-registered the address
          would keep a working password on the victim's now-verified account.
         */
        const updateData: {
            passwordHash?: string | null;
            authProvider?: "local" | "google";
            googleId?: string;
            avatar?: string;
            verified: boolean;
        } = {
            verified: true,
        };

        if (!user.verified && user.authProvider === "local") {
            updateData.passwordHash = null;
            updateData.authProvider = "google";
            await revokeSessions({ userId: user.id });
            await orm.VerificationLink
                .where({ userId: user.id })
                .deleteAll();
        }

        // Link Google profile if missing or update details
        if (!user.googleId && googleId) {
            updateData.googleId = googleId;
        }

        if (avatar && user.avatar !== avatar) {
            updateData.avatar = avatar;
        }

        const updated = await orm.User
            .where({ id: user.id })
            .update(updateData);

        if (updated) {
            user = updated;
        }
    } else {
        // Create new user (verified Google account)
        user = await orm.User.create({
            email,
            name: name || email.split("@")[0] || "User",
            googleId,
            authProvider: "google",
            avatar,
            verified: true,
        });
    }

    const { accessToken, refreshToken } = await createSessionAndTokens(user, req.headers["user-agent"]);

    // Set HttpOnly Cookies and Return SuccessResponse
    return setAuthCookies({ res, accessToken, refreshToken })
        .status(OK)
        .json(ok({
            user: omitPassword(user),
            message: "Google login successful!"
        }));
});
