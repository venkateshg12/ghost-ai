
const getEnv = (key: string, defaultValue?: string) => {

    const value = process.env[key] || defaultValue;

    if (value === undefined) {
        throw new Error(`Missing Environment varaible ${key}`)
    }

    return value;
}

export const PORT = getEnv("PORT", "5000");
export const NODE_ENV = getEnv("NODE_ENV", "development");
export const CORS_ORIGIN = getEnv("CORS_ORIGIN");
export const CLIENT_URL = getEnv("CLIENT_URL", CORS_ORIGIN.split(",")[0]!.trim());
export const DATABASE_URL = getEnv("DATABASE_URL");
export const JWT_SECRET = getEnv("JWT_SECRET");
export const JWT_REFRESH_SECRET = getEnv("JWT_REFRESH_SECRET");
const MIN_JWT_SECRET_LENGTH = 32;

if (JWT_SECRET.length < MIN_JWT_SECRET_LENGTH || JWT_REFRESH_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
        `JWT_SECRET and JWT_REFRESH_SECRET must each be at least ${MIN_JWT_SECRET_LENGTH} characters (generate with: openssl rand -hex 32)`
    );
}

if (JWT_SECRET === JWT_REFRESH_SECRET) {
    throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be different values");
}

/*
  Gmail API sender (see config/gmail.ts). All optional so the server still boots before the one-time
  authorization has produced GMAIL_REFRESH_TOKEN; sending fails with a clean error until it is set.
  GMAIL_SENDER_NAME is the display name shown next to the fixed sender address.
  GMAIL_OAUTH_SETUP exposes the authorization routes in production (they are always on elsewhere);
  set it to "true" only while re-authorizing.
 */
export const GMAIL_CLIENT_ID = getEnv("GMAIL_CLIENT_ID", "");
export const GMAIL_CLIENT_SECRET = getEnv("GMAIL_CLIENT_SECRET", "");
export const GMAIL_REDIRECT_URI = getEnv("GMAIL_REDIRECT_URI", "");
export const GMAIL_REFRESH_TOKEN = getEnv("GMAIL_REFRESH_TOKEN", "");
export const GMAIL_SENDER_NAME = getEnv("GMAIL_SENDER_NAME", "");
export const GMAIL_OAUTH_SETUP = getEnv("GMAIL_OAUTH_SETUP", "false");

// Google sign-in. Optional: the /auth/google route answers 500 until it is set.
export const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID", "");

export const TRUSTED_PROXY_CIDRS = getEnv("TRUSTED_PROXY_CIDRS", "");

/*
  Same-origin proxy deployments (web on Vercel, API on Render). The browser only ever talks to the web app's
  /backend route, which forwards to this API, so the auth cookies are first-party to the web origin and survive
  browsers that block third-party cookies. Two settings make that work:

  - PROXY_SHARED_SECRET: a secret known only to the web app and this API. A request carrying it may tell us the
    visitor's real IP (otherwise every user would look like the web host and share one rate-limit bucket). Empty
    turns the feature off, and the header is then never trusted.
  - REFRESH_COOKIE_PATH: the path the *browser* sees for the refresh endpoint (for the proxy mounted at
    /backend that is /backend/auth/refresh); the cookie is only sent to that path.
 */
export const PROXY_SHARED_SECRET = getEnv("PROXY_SHARED_SECRET", "");
export const REFRESH_COOKIE_PATH = getEnv("REFRESH_COOKIE_PATH", "/backend/auth/refresh");

/*
  SameSite for the auth cookies. "strict" is right whenever the browser only talks to the web app's origin (the
  proxy above), because the cookies are then first-party. "none" lets a web app on a *different site* call this API
  directly, but browsers that block third-party cookies (Brave, Safari, Firefox) will drop them, so it is a
  last resort for demos in Chrome. "lax" does not help: Lax cookies are not sent on cross-site fetch/XHR requests.
 */
export const AUTH_COOKIE_SAMESITE = getEnv("AUTH_COOKIE_SAMESITE", "strict").toLowerCase() as "strict" | "lax" | "none";
if (!["strict", "lax", "none"].includes(AUTH_COOKIE_SAMESITE)) {
    throw new Error('AUTH_COOKIE_SAMESITE must be "strict", "lax" or "none"');
}
if (AUTH_COOKIE_SAMESITE === "none" && NODE_ENV === "development") {
    // Browsers refuse SameSite=None without Secure, and Secure cookies need https.
    console.warn('AUTH_COOKIE_SAMESITE="none" needs https: in development the auth cookies will be rejected by the browser.');
}

const MIN_PROXY_SECRET_LENGTH = 24;
if (PROXY_SHARED_SECRET && PROXY_SHARED_SECRET.length < MIN_PROXY_SECRET_LENGTH) {
    throw new Error(`PROXY_SHARED_SECRET must be at least ${MIN_PROXY_SECRET_LENGTH} characters (generate with: openssl rand -hex 32)`);
}
if (!REFRESH_COOKIE_PATH.startsWith("/")) {
    throw new Error("REFRESH_COOKIE_PATH must start with /");
}
export const DEBUG_IP_ENDPOINT = getEnv("DEBUG_IP_ENDPOINT", "false");
export const ENABLE_QUEUE_DASHBOARD = getEnv("ENABLE_QUEUE_DASHBOARD", "false");
export const QUEUE_DASHBOARD_USER = getEnv("QUEUE_DASHBOARD_USER", "");
export const QUEUE_DASHBOARD_PASSWORD = getEnv("QUEUE_DASHBOARD_PASSWORD", "");

export const REDIS_HOST = getEnv("REDIS_HOST", "localhost");
export const REDIS_PORT = getEnv("REDIS_PORT", "6379");
// Empty for a local passwordless Redis; set both for a hosted one (e.g. Redis Cloud).
export const REDIS_USERNAME = getEnv("REDIS_USERNAME", "");
export const REDIS_PASSWORD = getEnv("REDIS_PASSWORD", "");
export const CACHE_REDIS_HOST = getEnv("CACHE_REDIS_HOST", REDIS_HOST);
export const CACHE_REDIS_PORT = getEnv("CACHE_REDIS_PORT", "6380");
export const CACHE_REDIS_USERNAME = getEnv("CACHE_REDIS_USERNAME", REDIS_USERNAME);
export const CACHE_REDIS_PASSWORD = getEnv("CACHE_REDIS_PASSWORD", REDIS_PASSWORD);
export const CACHE_ENABLED = getEnv("CACHE_ENABLED", "true");

// Realtime canvas. Room tokens, server-side canvas writes and feed messages all go through this key.
export const LIVEBLOCKS_SECRET_KEY = getEnv("LIVEBLOCKS_SECRET_KEY");

// Trigger.dev runs the AI tasks (src/trigger). The SDK reads TRIGGER_SECRET_KEY itself; it is
// required here so a missing key fails at boot rather than on the first AI request.
export const TRIGGER_SECRET_KEY = getEnv("TRIGGER_SECRET_KEY");

/*
  AI. Providers are tried in AI_PROVIDER_ORDER: NVIDIA (OpenAI-compatible NIM) first, Gemini second. With no
  key at all, development falls back to deterministic generators so the flow still runs end to end;
  production refuses (see utils/ai/providers.ts).
 */
export const NVIDIA_API_KEY = getEnv("NVIDIA_API_KEY", "");
export const NVIDIA_MODEL = getEnv("NVIDIA_MODEL", "nvidia/nemotron-3-super-120b-a12b");
export const NVIDIA_BASE_URL = getEnv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1");
export const GOOGLE_GENERATIVE_AI_API_KEY = getEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
export const GEMINI_MODEL = getEnv("GEMINI_MODEL", "gemini-3.8-flash");
// A second Gemini model tried right after the first. Free-tier quota and capacity are per model, so this
// survives the first one being rate limited or overloaded. Empty disables it.
export const GEMINI_FALLBACK_MODEL = getEnv("GEMINI_FALLBACK_MODEL", "gemini-3.1-flash-lite");
export const AI_PROVIDER_ORDER = getEnv("AI_PROVIDER_ORDER", "nvidia,google");

const positiveNumber = (key: string, fallback: number) => {
    const value = Number(getEnv(key, String(fallback)));
    return Number.isFinite(value) && value > 0 ? value : fallback;
};
// Per-attempt ceilings. NVIDIA's free tier ranges from 8s to 40s+ under load, so a slow attempt is
// abandoned for the next provider rather than waited on. AI_NVIDIA_TIMEOUT_MS overrides NVIDIA only
// (set it to 1 to force the fallback path when testing).
export const AI_TIMEOUT_MS = positiveNumber("AI_TIMEOUT_MS", 45_000);
export const AI_NVIDIA_TIMEOUT_MS = positiveNumber("AI_NVIDIA_TIMEOUT_MS", AI_TIMEOUT_MS);

// Artifact storage. With no token, canvas snapshots and specs are written under LOCAL_STORAGE_DIR.
export const BLOB_READ_WRITE_TOKEN = getEnv("BLOB_READ_WRITE_TOKEN", "");
export const LOCAL_STORAGE_DIR = getEnv("LOCAL_STORAGE_DIR", ".storage");
