import { describe, expect, it } from "vitest";
import type { RateLimiterRequest } from "../../types/ratelimiter.types";
import { UNKNOWN_IP, extractClientIp } from "./ipExtractor";

// Must match PROXY_SHARED_SECRET in vitest.config.ts.
const SECRET = "test-proxy-secret-0123456789-abcdef";

const request = (headers: Record<string, string>, peer = "10.0.0.7"): RateLimiterRequest =>
    ({ headers, socket: { remoteAddress: peer } }) as unknown as RateLimiterRequest;

describe("extractClientIp behind our own same-origin proxy", () => {
    it("uses the visitor IP the proxy reports when the request carries the shared secret", () => {
        expect(extractClientIp(request({ "x-ghost-proxy-secret": SECRET, "x-ghost-client-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    });

    it("understands IPv6 and IPv4-mapped IPv6 reports", () => {
        expect(extractClientIp(request({ "x-ghost-proxy-secret": SECRET, "x-ghost-client-ip": "2001:db8::5" }))).toBe("2001:db8::5");
        expect(extractClientIp(request({ "x-ghost-proxy-secret": SECRET, "x-ghost-client-ip": "::ffff:198.51.100.4" }))).toBe("198.51.100.4");
    });

    it("ignores the reported IP when the secret is wrong, so nobody can choose their own rate-limit bucket", () => {
        const ip = extractClientIp(request({ "x-ghost-proxy-secret": "guess-guess-guess-guess-guess!", "x-ghost-client-ip": "203.0.113.9" }));
        expect(ip).not.toBe("203.0.113.9");
        expect(ip).toBe("10.0.0.7"); // falls back to the real connection
    });

    it("ignores the reported IP when there is no secret at all", () => {
        expect(extractClientIp(request({ "x-ghost-client-ip": "203.0.113.9" }))).toBe("10.0.0.7");
    });

    it("ignores a reported value that is not an IP address", () => {
        expect(extractClientIp(request({ "x-ghost-proxy-secret": SECRET, "x-ghost-client-ip": "not-an-ip; DROP TABLE" }))).toBe("10.0.0.7");
        expect(extractClientIp(request({ "x-ghost-proxy-secret": SECRET, "x-ghost-client-ip": "" }))).toBe("10.0.0.7");
    });

    it("never trusts a client-sent X-Forwarded-For (no trusted proxies are configured in tests)", () => {
        expect(extractClientIp(request({ "x-forwarded-for": "203.0.113.200" }))).toBe("10.0.0.7");
    });

    it("returns the unknown marker when there is no peer and nothing valid is reported", () => {
        const req = { headers: {}, socket: {} } as unknown as RateLimiterRequest;
        expect(extractClientIp(req)).toBe(UNKNOWN_IP);
    });
});
