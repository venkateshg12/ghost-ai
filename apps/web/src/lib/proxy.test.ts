import { describe, expect, it } from "vitest";
import {
  buildTargetUrl,
  clientIpOf,
  forwardRequestHeaders,
  forwardResponseHeaders,
  gatewayError,
} from "./proxy";

describe("buildTargetUrl", () => {
  const base = "https://api.example.onrender.com";

  it("joins the path and query onto the API origin", () => {
    expect(buildTargetUrl(base, ["auth", "login"], "")).toBe(
      "https://api.example.onrender.com/auth/login",
    );
    expect(buildTargetUrl(base, ["projects", "abc"], "?a=1&b=two")).toBe(
      "https://api.example.onrender.com/projects/abc?a=1&b=two",
    );
  });

  it("keeps a base path prefix and tolerates a trailing slash", () => {
    expect(buildTargetUrl("https://host.example/v1/", ["health"], "")).toBe(
      "https://host.example/v1/health",
    );
  });

  it("re-encodes segments, so odd characters cannot change the meaning of the URL", () => {
    expect(buildTargetUrl(base, ["a b", "c?d#e"], "")).toBe(
      "https://api.example.onrender.com/a%20b/c%3Fd%23e",
    );
  });

  it("refuses path traversal and separators hidden in a segment", () => {
    expect(buildTargetUrl(base, ["..", "etc"], "")).toBeNull();
    expect(buildTargetUrl(base, [".", "x"], "")).toBeNull();
    expect(buildTargetUrl(base, ["a/b"], "")).toBeNull();
    expect(buildTargetUrl(base, ["a\\b"], "")).toBeNull();
  });

  it("cannot be pointed at another host or scheme by a crafted segment", () => {
    const url = buildTargetUrl(base, ["//evil.example", "x"], "");
    // a segment containing '/' is refused outright
    expect(url).toBeNull();
    const encoded = buildTargetUrl(base, ["evil.example@host"], "");
    expect(encoded && new URL(encoded).host).toBe("api.example.onrender.com");
  });

  it("rejects a bad or non-http base", () => {
    expect(buildTargetUrl("not a url", ["x"], "")).toBeNull();
    expect(buildTargetUrl("file:///etc/passwd", ["x"], "")).toBeNull();
    expect(buildTargetUrl("javascript:alert(1)", ["x"], "")).toBeNull();
  });
});

describe("forwardRequestHeaders", () => {
  const incoming = new Headers({
    cookie: "accessToken=abc",
    "content-type": "application/json",
    "user-agent": "UA",
    host: "app.vercel.app",
    origin: "https://app.vercel.app",
    authorization: "Bearer leak",
    "x-forwarded-for": "6.6.6.6",
    "x-plano-client-ip": "1.1.1.1",
    "x-plano-proxy-secret": "forged-by-the-browser",
  });

  it("forwards only the headers the API needs", () => {
    const out = forwardRequestHeaders(incoming, {});
    expect([...out.keys()].sort()).toEqual([
      "content-type",
      "cookie",
      "user-agent",
    ]);
  });

  it("drops identity headers a browser tries to send, and sets its own", () => {
    const out = forwardRequestHeaders(incoming, {
      secret: "real-secret",
      clientIp: "203.0.113.9",
    });
    expect(out.get("x-plano-proxy-secret")).toBe("real-secret");
    expect(out.get("x-plano-client-ip")).toBe("203.0.113.9");
    expect(out.get("x-forwarded-for")).toBeNull();
  });

  it("sends no identity headers at all when there is no secret configured", () => {
    const out = forwardRequestHeaders(incoming, { clientIp: "203.0.113.9" });
    expect(out.get("x-plano-client-ip")).toBeNull();
    expect(out.get("x-plano-proxy-secret")).toBeNull();
  });
});

describe("clientIpOf", () => {
  it("prefers x-real-ip, then the first x-forwarded-for entry", () => {
    expect(
      clientIpOf(
        new Headers({
          "x-real-ip": "198.51.100.1",
          "x-forwarded-for": "9.9.9.9",
        }),
      ),
    ).toBe("198.51.100.1");
    expect(
      clientIpOf(new Headers({ "x-forwarded-for": "198.51.100.2, 10.0.0.1" })),
    ).toBe("198.51.100.2");
    expect(clientIpOf(new Headers())).toBeUndefined();
  });
});

describe("forwardResponseHeaders", () => {
  it("returns every Set-Cookie and drops encoding/length headers that no longer match the decoded body", () => {
    const upstream = new Headers({
      "content-type": "application/json",
      "content-encoding": "gzip",
      "content-length": "42",
      server: "x",
    });
    upstream.append("set-cookie", "accessToken=a; Path=/; HttpOnly");
    upstream.append(
      "set-cookie",
      "refreshToken=r; Path=/backend/auth/refresh; HttpOnly",
    );
    const out = forwardResponseHeaders(upstream);
    expect(out.get("content-type")).toBe("application/json");
    expect(out.get("content-encoding")).toBeNull();
    expect(out.get("content-length")).toBeNull();
    expect(out.get("server")).toBeNull();
    expect(out.getSetCookie()).toHaveLength(2);
  });
});

describe("gatewayError", () => {
  it("uses the API's error envelope so the client treats it like any other API error", async () => {
    const res = gatewayError(504, "waking", "UPSTREAM_TIMEOUT");
    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      status: "error",
      data: null,
      errors: [{ message: "waking", code: "UPSTREAM_TIMEOUT" }],
    });
  });
});
