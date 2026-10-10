import type { IncomingMessage } from "http";
import ipaddr from "ipaddr.js";
import proxyaddr from "proxy-addr";

import crypto from "node:crypto";
import { PROXY_SHARED_SECRET, TRUSTED_PROXY_CIDRS } from "../../constants/env";
import type { RateLimiterRequest } from "../../types/ratelimiter.types";

/*
  Used when no trustworthy client IP can be determined.
 */
export const UNKNOWN_IP = "unknown";

/*
  Headers provided by trusted edge infrastructure.

 These headers are ONLY trusted when the actual TCP peer belongs
  to TRUSTED_PROXY_CIDRS.

  Only headers the edge always overwrites qualify. Cloudflare replaces any client-sent
  CF-Connecting-IP, but sets True-Client-IP only on Enterprise zones with the Managed
  Transform enabled — elsewhere a client's True-Client-IP passes straight through. Render's
  zone does set it today, but that is undocumented, and CF-Connecting-IP already carries the
  same value, so trusting True-Client-IP would add risk and nothing else.
 */
const EDGE_HEADERS = [
    "cf-connecting-ip",
] as const;

/*
  Headers set by our own same-origin proxy (the web app's /backend route). They are believed only when the
  request also carries PROXY_SHARED_SECRET, which no browser ever sees: the browser talks to the web app, and
  the web app adds both headers itself (overwriting anything the browser sent). Without the secret they are
  ignored, so nobody can pick their own rate-limit bucket by sending them.
 */
const PROXY_SECRET_HEADER = "x-ghost-proxy-secret";
const PROXY_CLIENT_IP_HEADER = "x-ghost-client-ip";

// Hashing first keeps the comparison length-independent: timingSafeEqual throws on a length mismatch.
const safeEqual = (a: string, b: string) =>
    crypto.timingSafeEqual(crypto.createHash("sha256").update(a).digest(), crypto.createHash("sha256").update(b).digest());

/** The visitor IP reported by our own proxy, or undefined if the request is not from it (or reports nothing valid). */
const proxiedClientIp = (req: RateLimiterRequest): string | undefined => {
    if (!PROXY_SHARED_SECRET) return undefined;

    const supplied = getHeaderValue(req, PROXY_SECRET_HEADER);
    if (!supplied || !safeEqual(supplied, PROXY_SHARED_SECRET)) return undefined;

    const reported = getHeaderValue(req, PROXY_CLIENT_IP_HEADER);
    if (!reported) return undefined;

    const normalized = normalizeIp(reported);
    return isValidIp(normalized) ? normalized : undefined;
};

/*
  Compile trusted proxy configuration once at startup.
 */
export const trustProxy = createTrustProxy(TRUSTED_PROXY_CIDRS);

/*
  Extract the client IP used by the rate limiter.
 
  Security model:
  0. If the request proves (shared secret) that it came through our own web proxy, use the IP it reports.
  1. Determine the actual TCP peer.
  2. Only trust Cloudflare's CF-Connecting-IP when that peer
     belongs to infrastructure we explicitly trust.
  3. Otherwise resolve the client IP using proxy-addr and our
     trusted-proxy configuration.
  4. Never manually trust X-Forwarded-For.
  5. Return UNKNOWN_IP if no valid IP can be determined.
 */
export function extractClientIp(
    req: RateLimiterRequest
): string {
    // Our own proxy, authenticated by a shared secret, reports the visitor directly.
    const proxied = proxiedClientIp(req);
    if (proxied) return proxied;

    const peer = req.socket?.remoteAddress;

    /*
      First check whether the actual connection came from one
      of our trusted edge proxies.
     */
    if (peer) {
        const normalizedPeer = normalizeIp(peer);

        if (trustProxy(normalizedPeer)) {
            for (const header of EDGE_HEADERS) {
                const value = getHeaderValue(req, header);

                if (!value) {
                    continue;
                }

                const normalizedValue = normalizeIp(value);

                if (isValidIp(normalizedValue)) {
                    return normalizedValue;
                }
            }
        }
    }

    /*
     * Resolve the client IP using proxy-addr.
     *
     * proxy-addr:
     * - understands X-Forwarded-For
     * - walks the proxy chain from the application outward
     * - stops at the first untrusted address
     * - supports IPv4 and IPv6
     */

    
    try {
        const xForwardedFor = getHeaderValue(req, "x-forwarded-for");
        const adaptedReq = {
            headers: {
                "x-forwarded-for": xForwardedFor,
            },
            socket: req.socket,
        } as unknown as IncomingMessage;

        const resolvedIp = proxyaddr(adaptedReq, trustProxy);

        if (resolvedIp) {
            const normalizedIp = normalizeIp(resolvedIp);

            if (isValidIp(normalizedIp)) {
                return normalizedIp;
            }
        }
    } catch {
        /*
         * Never allow malformed proxy information to become
         * a rate-limit key.
         */
    }

    return UNKNOWN_IP;
}

/**
 * Compile trusted proxy CIDRs.
 *
 * Example:
 *
 * TRUSTED_PROXY_CIDRS=10.20.30.0/24,2001:db8::/32
 */
function createTrustProxy(
    raw: string
): (ip: string, index?: number) => boolean {
    const entries = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

    try {
        const compiled = proxyaddr.compile(entries);

        return (ip: string, index: number = 0) => {
            return compiled(ip, index);
        };
    } catch (error) {
        throw new Error(
            `Invalid TRUSTED_PROXY_CIDRS configuration: ${
                error instanceof Error
                    ? error.message
                    : String(error)
            }`
        );
    }
}

/**
 * Read a header from either:
 *
 * - Fetch Headers / Headers-like objects
 * - Node / Express IncomingHttpHeaders
 */
function getHeaderValue(
    req: RateLimiterRequest,
    headerName: string
): string | undefined {
    if (!req.headers) {
        return undefined;
    }

    /*
     * Headers-like API.
     */
    if (
        "get" in req.headers &&
        typeof req.headers.get === "function"
    ) {
        return req.headers.get(headerName) ?? undefined;
    }

    /*
     * Node / Express headers object.
     */
    const headersObj = req.headers as Record<
        string,
        string | string[] | undefined
    >;

    const value =
        headersObj[headerName.toLowerCase()] ??
        headersObj[headerName];

    /*
     * Don't arbitrarily select one value when multiple
     * edge identity headers are present.
     */
    if (Array.isArray(value)) {
        if (value.length !== 1) {
            return undefined;
        }

        return value[0];
    }

    return value;
}

/**
 * Normalize an IP using ipaddr.js.
 *
 * Examples:
 *
 * ::ffff:192.168.1.10
 *     -> 192.168.1.10
 *
 * ::1
 *     -> ::1
 */
function normalizeIp(ip: string): string {
    const trimmed = ip.trim();

    if (!isValidIp(trimmed)) {
        return trimmed;
    }

    try {
        return ipaddr.process(trimmed).toString();
    } catch {
        return trimmed;
    }
}

/**
 * Validate IPv4 or IPv6.
 */
function isValidIp(ip: string): boolean {
    if (!ip || typeof ip !== "string") {
        return false;
    }

    return ipaddr.isValid(ip.trim());
}


/*
ipExtractor.ts works out the real client IP for my rate limiter. 
My app runs behind Cloudflare and Render's proxies, so the TCP 
connection always comes from a proxy, not the user. The file trusts 
proxy headers only when the connection comes from a proxy I've 
explicitly listed in TRUSTED_PROXY_CIDRS. In that case it reads 
Cloudflare's CF-Connecting-IP, which Cloudflare always overwrites,
so it can't be forged. Otherwise it falls back to the proxy-addr 
library, which walks X-Forwarded-For safely. If nothing valid comes 
out, it returns "unknown" instead of trusting garbage. The point is that 
nobody can choose their own rate-limit bucket by faking a header."


*/