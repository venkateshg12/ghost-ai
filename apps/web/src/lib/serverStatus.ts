// Statuses a host's proxy answers with while the app behind it is still starting.
const GATEWAY_STATUSES = [502, 503, 504];

/**
 * True when the failure says "the server isn't up yet" rather than "your request was wrong":
 * no response at all (status 0, e.g. a refused connection) or the proxy's gateway statuses. A free-tier API
 * sleeps when idle and takes up to a minute to wake, so these are worth retrying; a 4xx is not.
 */
export const isServerUnavailable = (status: unknown): boolean =>
  status === 0 ||
  (typeof status === "number" && GATEWAY_STATUSES.includes(status));

// About two minutes of patience in total: a cold start plus margin.
export const MAX_WAKE_RETRIES = 24;
export const wakeRetryDelay = (attempt: number) =>
  Math.min(2000 * (attempt + 1), 5000);
