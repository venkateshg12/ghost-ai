import { describe, expect, it, vi } from "vitest";
import { AllProvidersFailedError, RunCancelledError, isRetryable, runWithFallback, type Attempt } from "./runWithFallback";

const attempt = <T>(provider: string, run: Attempt<T>["run"], timeoutMs = 1_000): Attempt<T> => ({
    provider,
    modelId: `${provider}-model`,
    label: provider.toUpperCase(),
    timeoutMs,
    run,
});

const httpError = (statusCode: number, headers: Record<string, string> = {}) =>
    Object.assign(new Error(`HTTP ${statusCode} with a secret-looking payload sk-123`), { statusCode, responseHeaders: headers });

const noSleep = { sleep: async () => {} };

describe("runWithFallback", () => {
    it("returns the first provider's result and reports no fallback", async () => {
        const { value, meta } = await runWithFallback([attempt("nvidia", async () => "ok"), attempt("google", async () => "never")], noSleep);
        expect(value).toBe("ok");
        expect(meta).toMatchObject({ provider: "nvidia", fellBack: false });
        expect(meta.attempts).toHaveLength(1);
    });

    it("falls back to the next provider when the first fails, and says so", async () => {
        const { value, meta } = await runWithFallback(
            [attempt("nvidia", async () => Promise.reject(httpError(400))), attempt("google", async () => "from-google")],
            noSleep
        );
        expect(value).toBe("from-google");
        expect(meta).toMatchObject({ provider: "google", fellBack: true });
        expect(meta.attempts.map((a) => [a.provider, a.ok])).toEqual([["nvidia", false], ["google", true]]);
    });

    it("retries the same provider once on 429, waiting for Retry-After", async () => {
        const sleep = vi.fn(async () => {});
        let calls = 0;
        const { meta } = await runWithFallback(
            [
                attempt("nvidia", async () => {
                    if (++calls === 1) throw httpError(429, { "retry-after": "2" });
                    return "second-try";
                }),
            ],
            { sleep }
        );
        expect(calls).toBe(2);
        expect(sleep).toHaveBeenCalledWith(2_000);
        expect(meta.fellBack).toBe(false);
    });

    it("caps the Retry-After wait so a hostile header cannot stall a run", async () => {
        const sleep = vi.fn(async () => {});
        let calls = 0;
        await runWithFallback([attempt("nvidia", async () => (++calls === 1 ? Promise.reject(httpError(503, { "retry-after": "9999" })) : "ok"))], { sleep });
        expect(sleep).toHaveBeenCalledWith(5_000);
    });

    it("does not retry client errors, it moves on", async () => {
        let nvidiaCalls = 0;
        await runWithFallback(
            [
                attempt("nvidia", async () => {
                    nvidiaCalls++;
                    throw httpError(401);
                }),
                attempt("google", async () => "ok"),
            ],
            noSleep
        );
        expect(nvidiaCalls).toBe(1);
        expect(isRetryable(httpError(401))).toBe(false);
        expect(isRetryable(httpError(429))).toBe(true);
        expect(isRetryable(httpError(502))).toBe(true);
    });

    it("abandons a slow provider at its timeout and uses the next", async () => {
        const slow = attempt(
            "nvidia",
            (signal) => new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
            20
        );
        const { value, meta } = await runWithFallback([slow, attempt("google", async () => "fast")], noSleep);
        expect(value).toBe("fast");
        expect(meta.attempts[0]).toMatchObject({ provider: "nvidia", ok: false, error: "timed out" });
    });

    it("rejects a result that arrives in time but fails validation, and tries the next provider", async () => {
        const { value, meta } = await runWithFallback([attempt("nvidia", async () => "bad"), attempt("google", async () => "good")], {
            ...noSleep,
            validate: (result) => {
                if (result === "bad") throw new Error("not good enough");
            },
        });
        expect(value).toBe("good");
        expect(meta.fellBack).toBe(true);
    });

    it("gives the LAST provider one more try after a validation rejection", async () => {
        let calls = 0;
        const { value } = await runWithFallback([attempt("google", async () => (++calls === 1 ? "bad" : "good"))], {
            ...noSleep,
            validate: (result) => {
                if (result === "bad") throw new Error("thin");
            },
        });
        expect(calls).toBe(2);
        expect(value).toBe("good");
    });

    it("throws one error carrying every attempt when all providers fail, without leaking raw messages", async () => {
        const error = await runWithFallback(
            [attempt("nvidia", async () => Promise.reject(httpError(500))), attempt("google", async () => Promise.reject(httpError(429)))],
            noSleep
        ).catch((caught) => caught);
        expect(error).toBeInstanceOf(AllProvidersFailedError);
        const text = (error as AllProvidersFailedError).message;
        expect(text).toContain("nvidia");
        expect(text).toContain("google");
        expect(text).not.toContain("sk-123");
    });

    it("stops everything, without trying other providers, when the caller cancels", async () => {
        const controller = new AbortController();
        const second = vi.fn(async () => "never");
        const result = runWithFallback(
            [
                attempt("nvidia", async () => {
                    controller.abort();
                    throw new Error("aborted");
                }),
                attempt("google", second),
            ],
            { ...noSleep, signal: controller.signal }
        );
        await expect(result).rejects.toBeInstanceOf(RunCancelledError);
        expect(second).not.toHaveBeenCalled();
    });
});
