import { describe, expect, it } from "vitest";
import {
  MAX_WAKE_RETRIES,
  isServerUnavailable,
  wakeRetryDelay,
} from "./serverStatus";

describe("isServerUnavailable", () => {
  it("is true for no response and for gateway statuses", () => {
    for (const status of [0, 502, 503, 504])
      expect(isServerUnavailable(status)).toBe(true);
  });

  it("is false for anything the server actually decided", () => {
    for (const status of [
      200,
      400,
      401,
      403,
      404,
      409,
      422,
      429,
      500,
      undefined,
      null,
      "504",
    ])
      expect(isServerUnavailable(status)).toBe(false);
  });
});

describe("wakeRetryDelay", () => {
  it("backs off then holds at five seconds, so the whole wait stays near two minutes", () => {
    expect([0, 1, 2, 3, 10].map(wakeRetryDelay)).toEqual([
      2000, 4000, 5000, 5000, 5000,
    ]);
    const total = Array.from({ length: MAX_WAKE_RETRIES }, (_, i) =>
      wakeRetryDelay(i),
    ).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(90_000);
    expect(total).toBeLessThan(150_000);
  });
});
