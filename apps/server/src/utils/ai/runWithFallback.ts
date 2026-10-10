/*
  Runs one AI job against an ordered list of providers and returns the first result that is both
  produced in time and good enough.

  Why this exists: the primary provider (NVIDIA's free tier) answers in anywhere from 8s to 40s+ and
  sometimes returns a plan that is syntactically valid but useless. Neither is an error the SDK can
  see, so each attempt gets a hard time limit and a caller-supplied `validate`, and anything that
  fails either moves on to the next provider instead of surfacing to the user.

  Kept free of the AI SDK and of any I/O so it can be unit tested with fake attempts.
 */

export interface Attempt<T> {
    provider: string;
    modelId: string;
    /** Human-readable name for the UI, e.g. "Nemotron 3 Super". */
    label: string;
    timeoutMs: number;
    /** Must honour `signal`: it fires on timeout or when the caller cancels. */
    run: (signal: AbortSignal) => Promise<T>;
}

export interface AttemptRecord {
    provider: string;
    modelId: string;
    ok: boolean;
    latencyMs: number;
    /** Short, secret-free reason for a failed attempt. */
    error?: string;
}

export interface RunMeta {
    provider: string;
    modelId: string;
    label: string;
    latencyMs: number;
    /** True when the first provider in the list did not produce the result. */
    fellBack: boolean;
    attempts: AttemptRecord[];
}

export class AllProvidersFailedError extends Error {
    constructor(public readonly attempts: AttemptRecord[]) {
        super(
            `All AI providers failed: ${attempts.map((attempt) => `${attempt.provider} (${attempt.error ?? "unknown"})`).join("; ")}`
        );
        this.name = "AllProvidersFailedError";
    }
}

export class RunCancelledError extends Error {
    constructor() {
        super("The run was cancelled");
        this.name = "RunCancelledError";
    }
}

export interface RunOptions<T> {
    /** Throw to reject a result that arrived in time but is not good enough; the chain moves on. */
    validate?: (value: T) => void;
    /** Extra tries on the *same* provider after a retryable failure (429 or 5xx). Default 1. */
    retries?: number;
    /** Cancels the whole run (e.g. the user pressed Stop). */
    signal?: AbortSignal;
    /** Test seams. */
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}

const MAX_RETRY_WAIT_MS = 5_000;
const DEFAULT_RETRY_WAIT_MS = 1_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface ErrorLike {
    name?: string;
    message?: string;
    statusCode?: number;
    status?: number;
    responseHeaders?: Record<string, string | undefined>;
    cause?: unknown;
}

const statusOf = (error: unknown): number | undefined => {
    const { statusCode, status } = (error ?? {}) as ErrorLike;
    return statusCode ?? status;
};

const isTimeout = (error: unknown) => {
    const { name } = (error ?? {}) as ErrorLike;
    return name === "TimeoutError" || name === "AbortError";
};

// 429 and 5xx are worth one more try on the same provider; auth errors, bad requests and timeouts are not.
export const isRetryable = (error: unknown) => {
    const status = statusOf(error);
    return status === 429 || (status !== undefined && status >= 500 && status < 600);
};

const retryAfterMs = (error: unknown): number => {
    const header = ((error ?? {}) as ErrorLike).responseHeaders?.["retry-after"];
    const seconds = header === undefined ? NaN : Number(header);
    if (!Number.isFinite(seconds) || seconds < 0) return DEFAULT_RETRY_WAIT_MS;
    return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
};

/** A short reason that is safe to store and show: never the raw error, which can echo request data. */
export const describeFailure = (error: unknown): string => {
    if (isTimeout(error)) return "timed out";
    const status = statusOf(error);
    if (status === 429) return "rate limited (429)";
    if (status !== undefined) return `HTTP ${status}`;
    const message = ((error ?? {}) as ErrorLike).message ?? "failed";
    return message.replace(/\s+/g, " ").slice(0, 120);
};

export const runWithFallback = async <T>(
    attempts: Attempt<T>[],
    { validate, retries = 1, signal, sleep = defaultSleep, now = Date.now }: RunOptions<T> = {}
): Promise<{ value: T; meta: RunMeta }> => {
    const records: AttemptRecord[] = [];

    for (const [index, attempt] of attempts.entries()) {
        const isLast = index === attempts.length - 1;
        for (let tryNumber = 0; tryNumber <= retries; tryNumber++) {
            if (signal?.aborted) throw new RunCancelledError();

            const startedAt = now();
            const timeout = AbortSignal.timeout(attempt.timeoutMs);
            const combined = signal ? AbortSignal.any([timeout, signal]) : timeout;

            let value: T;
            try {
                value = await attempt.run(combined);
            } catch (error) {
                // A user cancel is not a provider failure: stop everything rather than try the next one.
                if (signal?.aborted) throw new RunCancelledError();

                records.push({
                    provider: attempt.provider,
                    modelId: attempt.modelId,
                    ok: false,
                    latencyMs: now() - startedAt,
                    error: describeFailure(error),
                });

                if (isRetryable(error) && tryNumber < retries) {
                    await sleep(retryAfterMs(error));
                    continue;
                }
                break; // next provider
            }

            try {
                validate?.(value);
            } catch (error) {
                records.push({
                    provider: attempt.provider,
                    modelId: attempt.modelId,
                    ok: false,
                    latencyMs: now() - startedAt,
                    error: describeFailure(error),
                });
                // A rejected result moves on to the next provider. With none left, one more try is
                // the only chance, and these models are not deterministic.
                if (isLast && tryNumber < retries) continue;
                break;
            }

            const latencyMs = now() - startedAt;
            records.push({ provider: attempt.provider, modelId: attempt.modelId, ok: true, latencyMs });
            return {
                value,
                meta: {
                    provider: attempt.provider,
                    modelId: attempt.modelId,
                    label: attempt.label,
                    latencyMs,
                    fellBack: index > 0,
                    attempts: records,
                },
            };
        }
    }

    throw new AllProvidersFailedError(records);
};
