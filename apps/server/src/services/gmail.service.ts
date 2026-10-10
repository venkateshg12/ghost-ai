import crypto from "node:crypto";
import { Auth, gmail_v1, google } from "googleapis";
import { z } from "zod";
import { GMAIL_REFRESH_TOKEN, GMAIL_SENDER_NAME } from "../constants/env";
import { BAD_GATEWAY, BAD_REQUEST, HttpStatusCode, INTERNAL_SERVER_ERROR, TOO_MANY_REQUESTS } from "../constants/http";
import { appErrorCode } from "../constants/appErrorCode";
import { GMAIL_SCOPES, GMAIL_SENDER_ADDRESS, getGmailOAuthClient } from "../config/gmail";
import { AppError, appAssert } from "../utils/errors";

/*
  Sends mail through the Gmail API as GMAIL_SENDER_ADDRESS, using a long-lived refresh token: the
  OAuth2 client exchanges it for short-lived access tokens by itself, so nobody signs in per email.

  Kept free of req/res and of any queue so it can later be called from a BullMQ processor or moved
  into a standalone email service unchanged.
 */

const hasText = (value?: string) => Boolean(value?.trim());

// Header values must be a single line: a CR/LF here is how header injection happens.
const singleLine = z.string().trim().refine((value) => !/[\r\n]/.test(value), "Must be a single line");

const sendEmailSchema = z
    .object({
        to: z.string().trim().email("Invalid recipient email address"),
        subject: singleLine.pipe(z.string().min(1, "Subject is required").max(300, "Subject is too long")),
        text: z.string().optional(),
        html: z.string().optional(),
    })
    .refine((email) => hasText(email.text) || hasText(email.html), {
        message: "Provide a text body, an html body, or both",
        path: ["text"],
    });

// Deliberately has no `from`: the sender identity belongs to the application, not the caller.
export type SendEmailInput = z.input<typeof sendEmailSchema>;

// ---------------------------------------------------------------------------------------------
// MIME construction
// ---------------------------------------------------------------------------------------------

const CRLF = "\r\n";
const isAscii = (value: string) => /^[\x20-\x7e]*$/.test(value);

// RFC 2047 encoded-words are capped at 75 characters, so long non-ASCII values are split on
// character boundaries (never mid-code-point) into several words.
const encodeHeaderValue = (value: string): string => {
    if (isAscii(value)) return value;

    const MAX_CHUNK_BYTES = 45; // 45 bytes -> 60 base64 chars, plus 12 of "=?UTF-8?B??="
    const words: string[] = [];
    let chunk = "";

    for (const char of value) {
        if (Buffer.byteLength(chunk + char) > MAX_CHUNK_BYTES) {
            words.push(chunk);
            chunk = "";
        }
        chunk += char;
    }
    if (chunk) words.push(chunk);

    return words.map((word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`).join(`${CRLF} `);
};

const formatFromHeader = (): string => {
    // Control characters have no place in a display name, and would break the header.
    const name = GMAIL_SENDER_NAME.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (!name) return GMAIL_SENDER_ADDRESS;

    const displayName = isAscii(name) ? `"${name.replace(/(["\\])/g, "\\$1")}"` : encodeHeaderValue(name);
    return `${displayName} <${GMAIL_SENDER_ADDRESS}>`;
};

// Base64 bodies are wrapped at 76 characters, as MIME requires.
const encodeBody = (content: string) =>
    Buffer.from(content, "utf8")
        .toString("base64")
        .replace(/.{1,76}/g, "$&" + CRLF)
        .trimEnd();

const bodyPart = (contentType: "text/plain" | "text/html", content: string) =>
    [`Content-Type: ${contentType}; charset="UTF-8"`, "Content-Transfer-Encoding: base64", "", encodeBody(content)].join(CRLF);

const buildMimeMessage = ({ to, subject, text, html }: z.output<typeof sendEmailSchema>): string => {
    const headers = [
        `From: ${formatFromHeader()}`,
        `To: ${to}`,
        `Subject: ${encodeHeaderValue(subject)}`,
        "MIME-Version: 1.0",
    ];

    const textBody = hasText(text) ? text! : undefined;
    const htmlBody = hasText(html) ? html! : undefined;

    // Only one body: a plain single-part message.
    if (!textBody || !htmlBody) {
        const [contentType, content] = htmlBody ? (["text/html", htmlBody] as const) : (["text/plain", textBody!] as const);
        return [...headers, bodyPart(contentType, content)].join(CRLF);
    }

    // Both: multipart/alternative, plain text first so clients prefer the last (html) part.
    const boundary = `alt_${crypto.randomBytes(16).toString("hex")}`;
    return [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        bodyPart("text/plain", textBody),
        `--${boundary}`,
        bodyPart("text/html", htmlBody),
        `--${boundary}--`,
        "",
    ].join(CRLF);
};

// ---------------------------------------------------------------------------------------------
// Google error mapping
// ---------------------------------------------------------------------------------------------

type GoogleErrorShape = {
    code?: string | number;
    response?: { status?: number; data?: { error?: unknown } };
};

/*
  Reduces a googleapis failure to an AppError. The raw error is never logged or returned: a Gaxios
  error carries the request config, including the Authorization header and the client secret.
 */
const toAppError = (error: unknown): AppError => {
    if (error instanceof AppError) return error;

    const { code, response } = (error ?? {}) as GoogleErrorShape;
    const status = response?.status;
    const body = response?.data?.error;

    // The token endpoint answers with a string ("invalid_grant"); the Gmail API with an object.
    const oauthError = typeof body === "string" ? body : undefined;
    const apiReason =
        typeof body === "object" && body !== null
            ? ((body as { errors?: { reason?: string }[] }).errors?.[0]?.reason ?? (body as { status?: string }).status)
            : undefined;

    console.error("[gmail] Failed to send email", { status, code, oauthError, apiReason });

    const fail = (httpStatus: HttpStatusCode, message: string, errorCode: appErrorCode) =>
        new AppError(httpStatus, message, errorCode);

    if (oauthError === "invalid_grant" || oauthError === "invalid_client" || oauthError === "unauthorized_client" || status === 401) {
        return fail(
            INTERNAL_SERVER_ERROR,
            "Gmail authorization is invalid or has expired; re-run the Gmail authorization and update GMAIL_REFRESH_TOKEN",
            appErrorCode.GmailAuthInvalid
        );
    }
    if (status === 429 || (status === 403 && /ratelimit|dailylimit|quota/i.test(apiReason ?? ""))) {
        return fail(TOO_MANY_REQUESTS, "Gmail sending limit reached; try again later", appErrorCode.GmailSendFailed);
    }
    if (status === 400) {
        return fail(BAD_REQUEST, "Gmail rejected the message; check the recipient and content", appErrorCode.GmailSendFailed);
    }
    if (status === 403) {
        return fail(
            BAD_GATEWAY,
            "Gmail denied the request; check the Gmail API is enabled and the gmail.send scope was granted",
            appErrorCode.GmailSendFailed
        );
    }
    return fail(BAD_GATEWAY, "Failed to send email through Gmail", appErrorCode.GmailSendFailed);
};

// ---------------------------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------------------------

let gmailClient: gmail_v1.Gmail | undefined;

const getGmailClient = (): gmail_v1.Gmail => {
    appAssert(
        GMAIL_REFRESH_TOKEN,
        INTERNAL_SERVER_ERROR,
        "Gmail is not authorized yet (GMAIL_REFRESH_TOKEN is not set); complete the one-time Gmail authorization",
        appErrorCode.GmailNotConfigured
    );

    if (!gmailClient) {
        const auth = getGmailOAuthClient();
        // Only the refresh token is stored; the client fetches and renews access tokens itself.
        auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
        gmailClient = google.gmail({ version: "v1", auth });
    }
    return gmailClient;
};

export const sendEmail = async (input: SendEmailInput): Promise<{ messageId: string }> => {
    const email = sendEmailSchema.parse(input);
    const gmail = getGmailClient();

    let raw: string;
    try {
        raw = Buffer.from(buildMimeMessage(email), "utf8").toString("base64url");
    } catch {
        throw new AppError(INTERNAL_SERVER_ERROR, "Failed to build the email message", appErrorCode.GmailSendFailed);
    }

    try {
        const { data } = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        console.log("[gmail] Email sent successfully", { messageId: data.id });
        return { messageId: data.id ?? "" };
    } catch (error) {
        throw toAppError(error);
    }
};

// ---------------------------------------------------------------------------------------------
// One-time authorization (the browser flow that produces GMAIL_REFRESH_TOKEN)
// ---------------------------------------------------------------------------------------------

export const getGmailAuthUrl = (state: string): string =>
    getGmailOAuthClient().generateAuthUrl({
        access_type: "offline", // ask for a refresh token
        prompt: "consent", // and make Google issue one even if this account authorized before
        scope: GMAIL_SCOPES,
        state,
        // Pre-selects the sender account so a personal account isn't picked by accident.
        login_hint: GMAIL_SENDER_ADDRESS,
    });

export const exchangeGmailAuthCode = async (code: string): Promise<string> => {
    let tokens: Auth.Credentials;
    try {
        ({ tokens } = await getGmailOAuthClient().getToken(code));
    } catch (error) {
        // Never log the error object itself: it can carry the code and client secret.
        const status = (error as GoogleErrorShape)?.response?.status;
        console.error("[gmail] Authorization code exchange failed", { status });
        throw new AppError(BAD_REQUEST, "Invalid or expired authorization code; start again at /api/auth/gmail", appErrorCode.GmailAuthInvalid);
    }

    appAssert(
        tokens.scope?.split(" ").includes(GMAIL_SCOPES[0]),
        BAD_REQUEST,
        "The gmail.send permission was not granted",
        appErrorCode.GmailAuthInvalid
    );
    appAssert(
        tokens.refresh_token,
        BAD_GATEWAY,
        "Google did not return a refresh token; remove this app at myaccount.google.com/permissions for the sender account and try again",
        appErrorCode.GmailAuthInvalid
    );

    return tokens.refresh_token;
};
