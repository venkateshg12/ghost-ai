import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { JSONValue, LanguageModel } from "ai";
import {
    AI_NVIDIA_TIMEOUT_MS,
    AI_PROVIDER_ORDER,
    AI_TIMEOUT_MS,
    GEMINI_FALLBACK_MODEL,
    GEMINI_MODEL,
    GOOGLE_GENERATIVE_AI_API_KEY,
    NODE_ENV,
    NVIDIA_API_KEY,
    NVIDIA_BASE_URL,
    NVIDIA_MODEL,
} from "../../constants/env";
import type { Attempt } from "./runWithFallback";

export type ProviderId = "nvidia" | "google";
export type ProviderOptions = Record<string, Record<string, JSONValue>>;

export interface ProviderModel {
    provider: ProviderId;
    modelId: string;
    /** Human-readable model name for the UI. */
    label: string;
    model: LanguageModel;
    timeoutMs: number;
    /** Can read images. The NVIDIA text models cannot; Gemini can. */
    vision?: boolean;
    /** Request-body extras for this provider, passed straight through as `providerOptions`. */
    providerOptions?: ProviderOptions;
}

const titleCase = (text: string) =>
    text
        .split(/[-_]/)
        .filter(Boolean)
        .map((word) => (/^\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
        .join(" ");

/** "nvidia/nemotron-3-super-120b-a12b" -> "Nemotron 3 Super"; "gemini-3.8-flash" -> "Gemini 3.8 Flash". */
export const friendlyModelName = (modelId: string) =>
    titleCase((modelId.split("/").pop() ?? modelId).replace(/-\d+b(?:-a\d+b)?$/i, "").replace(/-instruct$/i, ""));

const nvidia = NVIDIA_API_KEY
    ? createOpenAICompatible({
          name: "nvidia",
          baseURL: NVIDIA_BASE_URL,
          apiKey: NVIDIA_API_KEY,
          supportsStructuredOutputs: true,
          includeUsage: true,
      })
    : null;

const google = GOOGLE_GENERATIVE_AI_API_KEY ? createGoogleGenerativeAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY }) : null;

const buildGoogle = (modelId: string): ProviderModel => ({
    provider: "google",
    modelId,
    label: friendlyModelName(modelId),
    model: google!(modelId),
    timeoutMs: AI_TIMEOUT_MS,
    vision: true,
});

// Every model this provider id stands for, best first. Gemini contributes two: the main model and a backup.
const build = (id: ProviderId): ProviderModel[] => {
    if (id === "nvidia" && nvidia) {
        return [
            {
                provider: "nvidia",
                modelId: NVIDIA_MODEL,
                label: friendlyModelName(NVIDIA_MODEL),
                model: nvidia(NVIDIA_MODEL),
                timeoutMs: AI_NVIDIA_TIMEOUT_MS,
                // Nemotron 3 is a reasoning model. Measured against this key, thinking off was both faster and more
                // reliable for structured edits (one thinking-on run produced 11 nodes and a single edge).
                providerOptions: { nvidia: { chat_template_kwargs: { enable_thinking: false } } },
            },
        ];
    }
    if (id === "google" && google) {
        const backup = GEMINI_FALLBACK_MODEL && GEMINI_FALLBACK_MODEL !== GEMINI_MODEL ? [buildGoogle(GEMINI_FALLBACK_MODEL)] : [];
        return [buildGoogle(GEMINI_MODEL), ...backup];
    }
    return [];
};

/*
  The configured providers in priority order (AI_PROVIDER_ORDER, NVIDIA first by default). A provider
  without a key is skipped. Empty means "no AI configured": development then uses the offline
  generators, but production refuses so canned output can never pass for AI.
 */
export const getProviderChain = (): ProviderModel[] => {
    const wanted = AI_PROVIDER_ORDER.split(",")
        .map((id) => id.trim().toLowerCase())
        .filter((id): id is ProviderId => id === "nvidia" || id === "google");

    const chain = [...new Set(wanted)].flatMap(build);

    if (chain.length === 0 && NODE_ENV === "production") {
        throw new Error("No AI provider is configured: set NVIDIA_API_KEY and/or GOOGLE_GENERATIVE_AI_API_KEY");
    }
    return chain;
};

/** Turns one provider-specific call into the attempt list `runWithFallback` walks. */
export const attemptsFor = <T>(
    call: (provider: ProviderModel, signal: AbortSignal) => Promise<T>,
    chain: ProviderModel[] = getProviderChain(),
    timeoutScale = 1
): Attempt<T>[] =>
    chain.map((provider) => ({
        provider: provider.provider,
        modelId: provider.modelId,
        label: provider.label,
        timeoutMs: provider.timeoutMs * timeoutScale,
        run: (signal) => call(provider, signal),
    }));

/** The providers that can read an image: sketches skip NVIDIA's text-only models. */
export const getVisionChain = (): ProviderModel[] => getProviderChain().filter((provider) => provider.vision);
