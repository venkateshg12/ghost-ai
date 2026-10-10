import { Auth, google } from "googleapis";
import { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI } from "../constants/env";
import { INTERNAL_SERVER_ERROR } from "../constants/http";
import { appErrorCode } from "../constants/appErrorCode";
import { appAssert } from "../utils/errors";

// The one permission requested: sending. Never widen this to read/modify/full-mailbox scopes.
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

// The sender identity is fixed by the application, never taken from a caller.
export const GMAIL_SENDER_ADDRESS = "noreply.gvprojects@gmail.com";

let oauthClient: Auth.OAuth2Client | undefined;

/*
  The single OAuth2 client for the Gmail project ("GV Email Service"), deliberately separate from
  the Google sign-in client in GOOGLE_CLIENT_ID. Created on first use so a server without Gmail
  configured still boots; it then fails here, with a clean error, instead of at import time.
 */
export const getGmailOAuthClient = (): Auth.OAuth2Client => {
    appAssert(
        GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REDIRECT_URI,
        INTERNAL_SERVER_ERROR,
        "Gmail is not configured on the server (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI)",
        appErrorCode.GmailNotConfigured
    );

    oauthClient ??= new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI);
    return oauthClient;
};
