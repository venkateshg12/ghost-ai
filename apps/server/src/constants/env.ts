
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

// Email. With no RESEND_API_KEY, sendMail logs the message to the console instead (local development).
export const RESEND_API_KEY = getEnv("RESEND_API_KEY", "");
export const EMAIL_FROM = getEnv("EMAIL_FROM", "Ghost AI <onboarding@resend.dev>");

// Google sign-in. Optional: the /auth/google route answers 500 until it is set.
export const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID", "");

export const TRUSTED_PROXY_CIDRS = getEnv("TRUSTED_PROXY_CIDRS", "");
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

// AI. With no key the design and spec tasks fall back to deterministic generators, so the whole flow
// still runs end to end in development.
export const GOOGLE_GENERATIVE_AI_API_KEY = getEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
export const GEMINI_MODEL = getEnv("GEMINI_MODEL", "gemini-2.5-flash");

// Artifact storage. With no token, canvas snapshots and specs are written under LOCAL_STORAGE_DIR.
export const BLOB_READ_WRITE_TOKEN = getEnv("BLOB_READ_WRITE_TOKEN", "");
export const LOCAL_STORAGE_DIR = getEnv("LOCAL_STORAGE_DIR", ".storage");
