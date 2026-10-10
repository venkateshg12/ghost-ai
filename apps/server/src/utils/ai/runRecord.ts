import { orm } from "../../prisma/db";
import type { AiMeta } from "@repo/types";
import { AllProvidersFailedError, type RunMeta } from "./runWithFallback";
import type { TokenUsage } from "./design";

export type RunStatus = "completed" | "failed" | "cancelled";

interface RunResultFields {
    status: RunStatus;
    meta?: RunMeta;
    usage?: TokenUsage;
    snapshotPath?: string | null;
}

/*
  Writes how a run ended onto its TaskRun row: which model answered, how long it took, the token cost
  and where the undo snapshot lives. Observability must never break the run it describes, so a failed
  write is logged and swallowed.
 */
export const recordRunResult = async (runId: string, { status, meta, usage, snapshotPath }: RunResultFields) => {
    try {
        await orm.TaskRun.where({ runId }).update({
            status,
            completedAt: new Date().toISOString(),
            ...(meta ? { provider: meta.provider, model: meta.modelId, latencyMs: Math.round(meta.latencyMs), fellBack: meta.fellBack } : {}),
            ...(usage?.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
            ...(usage?.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
            ...(snapshotPath ? { snapshotPath } : {}),
        });
    } catch (error) {
        console.warn(`[ai] could not record result for run ${runId}:`, error);
    }
};

/** The model details shown under a reply in the chat. */
export const toAiMeta = (meta: RunMeta, usage: TokenUsage = {}): AiMeta => ({
    provider: meta.provider,
    model: meta.modelId,
    label: meta.label,
    latencyMs: Math.round(meta.latencyMs),
    fellBack: meta.fellBack,
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
});

const PROVIDER_NAMES: Record<string, string> = { nvidia: "NVIDIA", google: "Gemini" };

/** A message for the chat when every provider failed: what happened to each, in plain words. */
export const describeProviderFailure = (error: AllProvidersFailedError) => {
    const last = new Map(error.attempts.map((attempt) => [attempt.provider, attempt.error ?? "failed"]));
    const parts = [...last].map(([provider, reason]) => `${PROVIDER_NAMES[provider] ?? provider}: ${reason}`);
    return `Sorry, I couldn't get an answer from the AI providers (${parts.join(" · ")}). Please try again in a moment.`;
};
