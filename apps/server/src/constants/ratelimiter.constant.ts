export const DEFAULT_KEY_PREFIX = "rl:global";
export const GLOBAL_VISITOR_PREFIX = "rl:global:guest";
export const GLOBAL_IP_PREFIX = "rl:global:ip";

export const AUTH_LOGIN_PREFIX = "rl:auth:login";
// The same endpoints, counted along two more axes: one bucket per account regardless of where the
// attempts come from, and one per source regardless of which account is being tried.
export const AUTH_LOGIN_ACCOUNT_PREFIX = "rl:auth:login:account";
export const AUTH_LOGIN_SOURCE_PREFIX = "rl:auth:login:source";
export const AUTH_FORGOT_ACCOUNT_PREFIX = "rl:auth:forgot:account";
export const AUTH_FORGOT_SOURCE_PREFIX = "rl:auth:forgot:source";
export const AUTH_REGISTER_PREFIX = "rl:auth:register";
export const AUTH_REGISTER_SOURCE_PREFIX = "rl:auth:register:source";
export const AUTH_FORGOT_PASS_PREFIX = "rl:auth:forgot";
export const AUTH_RESET_PREFIX = "rl:auth:reset";
export const AUTH_VERIFY_PREFIX = "rl:auth:verify";
export const AUTH_VERIFY_RESEND_SOURCE_PREFIX = "rl:auth:verify:resend:source";
export const AUTH_VERIFY_RESEND_ACCOUNT_PREFIX = "rl:auth:verify:resend:account";
export const AUTH_REFRESH_PREFIX = "rl:auth:refresh";
export const AUTH_REFRESH_SOURCE_PREFIX = "rl:auth:refresh:source";

export const AI_GENERATE_PREFIX = "rl:ai:generate";
export const PROTECTED_API_PREFIX = "rl:protected";
export const LOCKOUT_PREFIX = "rl:lockout";

export const HTTP_HEADERS = {
    RETRY_AFTER: "Retry-After",
    RATELIMIT_LIMIT: "X-RateLimit-Limit",
    RATELIMIT_REMAINING: "X-RateLimit-Remaining",
    RATELIMIT_IP_REMAINING: "X-RateLimit-IP-Remaining",
    RATELIMIT_RESET: "X-RateLimit-Reset"
} as const;

export const ONE_MINUTE_MS = 60 * 1000;
export const FIVE_MINUTES_MS = 5 * 60 * 1000;
export const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
export const THIRTY_MINUTES_MS = 30 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;
export const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_MAX_REQUESTS = 100;

export const CIRCUIT_BREAKER_DEFAULTS = {
    FAILURE_THRESHOLD: 10,
    RESET_TIMEOUT_MS: 30000
};

