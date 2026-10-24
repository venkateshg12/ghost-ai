import type { NextRequest } from "next/server";
import {
  buildTargetUrl,
  clientIpOf,
  forwardRequestHeaders,
  forwardResponseHeaders,
  gatewayError,
} from "@/lib/proxy";

/*
  Same-origin proxy to the API. The browser calls /backend/<api path> on this app's own origin (set
  NEXT_PUBLIC_API_URL=/backend); this handler forwards it to the API server-side and returns the answer,
  including Set-Cookie. See lib/proxy.ts for why, and for exactly what is allowed to cross.

  Server-only settings:
    API_PROXY_TARGET    the API's origin, e.g. https://plano-api.onrender.com
    PROXY_SHARED_SECRET the same secret the API has, which lets it trust the visitor IP we report
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The most a Vercel Hobby function may run. A free API instance can take up to a minute to wake from sleep.
export const maxDuration = 60;

// Stop waiting just before the function itself would be cut off, so the browser gets a clear answer.
const UPSTREAM_TIMEOUT_MS = 55_000;

type Context = { params: Promise<{ path: string[] }> };

const forward = async (
  request: NextRequest,
  { params }: Context,
): Promise<Response> => {
  const base = process.env.API_PROXY_TARGET;
  if (!base)
    return gatewayError(
      500,
      "The API proxy is not configured (API_PROXY_TARGET).",
      "PROXY_NOT_CONFIGURED",
    );

  const { path } = await params;
  const target = buildTargetUrl(base, path, request.nextUrl.search);
  if (!target)
    return gatewayError(400, "Invalid request path.", "BAD_PROXY_PATH");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const headers = forwardRequestHeaders(request.headers, {
    secret: process.env.PROXY_SHARED_SECRET,
    clientIp: clientIpOf(request.headers),
  });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      // Streaming a request body requires half-duplex mode.
      ...(hasBody ? { duplex: "half" } : {}),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    } as RequestInit);
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    return timedOut
      ? gatewayError(
          504,
          "The server is waking up. This can take up to a minute on the free tier; please try again.",
          "UPSTREAM_TIMEOUT",
        )
      : gatewayError(
          502,
          "The server could not be reached. Please try again in a moment.",
          "UPSTREAM_UNREACHABLE",
        );
  }

  // The API never redirects; if something upstream does, do not follow it out of the proxy.
  if (upstream.status >= 300 && upstream.status < 400) {
    return gatewayError(
      502,
      "Unexpected response from the server.",
      "UPSTREAM_REDIRECT",
    );
  }

  return new Response(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: forwardResponseHeaders(upstream.headers),
  });
};

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
