/*
  Pure helpers for the same-origin API proxy (app/backend/[...path]/route.ts). They hold every decision about
  what crosses the proxy, so each can be tested without a network.

  Why a proxy at all: on free tiers the web app (vercel.app) and the API (onrender.com) are different sites, so
  the browser would refuse to send the SameSite auth cookies, and browsers that block third-party cookies
  (Brave, Safari, Firefox) would drop them even with SameSite=None. If the browser only ever talks to the web
  app's own origin, the cookies are first-party and work everywhere.
 */

// Only these request headers are forwarded. Everything else, including anything named x-ghost-*,
// x-forwarded-* or host, is dropped, so a browser cannot smuggle identity headers to the API.
const FORWARD_REQUEST_HEADERS = [
  "cookie",
  "content-type",
  "accept",
  "accept-language",
  "user-agent",
] as const;

// Only these response headers come back (set-cookie is handled on its own because there can be several).
// content-encoding and content-length are deliberately absent: fetch has already decoded the body.
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "cache-control",
  "retry-after",
] as const;

export const PROXY_SECRET_HEADER = "x-ghost-proxy-secret";
export const PROXY_CLIENT_IP_HEADER = "x-ghost-client-ip";

/** The visitor's IP as the hosting platform reports it. Vercel sets these itself, overwriting anything the browser sent. */
export const clientIpOf = (headers: Headers): string | undefined => {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : undefined;
};

export const forwardRequestHeaders = (
  incoming: Headers,
  options: { secret?: string; clientIp?: string },
): Headers => {
  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value) headers.set(name, value);
  }
  if (options.secret) {
    headers.set(PROXY_SECRET_HEADER, options.secret);
    if (options.clientIp) headers.set(PROXY_CLIENT_IP_HEADER, options.clientIp);
  }
  return headers;
};

export const forwardResponseHeaders = (upstream: Headers): Headers => {
  const headers = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value) headers.set(name, value);
  }
  for (const cookie of upstream.getSetCookie())
    headers.append("set-cookie", cookie);
  return headers;
};

/*
  The API URL for a proxied request. Each path segment is re-encoded and appended to the configured base, so a
  request cannot change the host, climb out of the base path, or smuggle in a different scheme.
 */
export const buildTargetUrl = (
  base: string,
  segments: readonly string[],
  search: string,
): string | null => {
  if (
    segments.some(
      (segment) =>
        segment === ".." ||
        segment === "." ||
        segment.includes("/") ||
        segment.includes("\\"),
    )
  )
    return null;

  let target: URL;
  try {
    target = new URL(base);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return null;

  const prefix = target.pathname.replace(/\/+$/, "");
  target.pathname = `${prefix}/${segments.map(encodeURIComponent).join("/")}`;
  target.search = search;
  target.hash = "";
  return target.toString();
};

// Statuses a host's proxy answers with while the app behind it is still starting.
export const GATEWAY_STATUSES = [502, 503, 504] as const;

/** An error in the same envelope the API uses, so the web client handles it like any other API error. */
export const gatewayError = (
  status: number,
  message: string,
  code: string,
): Response =>
  Response.json(
    { status: "error", data: null, errors: [{ message, code }] },
    { status, headers: { "cache-control": "no-store" } },
  );
