import { generateText, Output } from "ai";
import type { ImageType } from "@repo/types";
import { DESIGN_SYSTEM_PROMPT, MAX_DESIGN_OPERATIONS, designPlanSchema, type DesignResult } from "./design";
import { assertPlanQuality, repairPlan } from "./planQuality";
import { attemptsFor, filterOpenCircuits, getVisionChain, recordCircuitBreakerAttempts } from "./providers";
import { AllProvidersFailedError, runWithFallback, type RunMeta } from "./runWithFallback";
import { describeGraph, type FlowGraph } from "./graph";

const VISION_ADDENDUM = `

The user attached an image: a photo of a whiteboard, a hand-drawn sketch or a screenshot of an architecture diagram.
Reproduce it on the canvas:
- Every labelled box, cylinder or shape is a node; keep its label as written, and choose the shape that fits what it is.
- Every arrow or line between two shapes is an edge; label it if the image does.
- If text is unreadable or ambiguous, leave that part out rather than guessing.
- Ignore decoration, handwriting that is not part of the diagram, and anything that is not architecture.`;

export interface ImageInput {
    bytes: Buffer;
    mediaType: ImageType;
}

export class NoVisionProviderError extends Error {
    constructor() {
        super("Reading images needs a Gemini API key; no vision-capable AI provider is configured");
        this.name = "NoVisionProviderError";
    }
}

/*
  Sketch to diagram: the same edit-plan schema, repair step and quality gate as a text prompt, but the model
  is shown the image. Only vision-capable providers are tried, so this path uses Gemini, not NVIDIA's text
  models.
 */
export const generateImagePlan = async (image: ImageInput, prompt: string, graph: FlowGraph, options: { signal?: AbortSignal } = {}): Promise<DesignResult> => {
    const rawChain = getVisionChain();
    if (rawChain.length === 0) throw new NoVisionProviderError();

    const chain = await filterOpenCircuits(rawChain);

    let value: { plan: ReturnType<typeof repairPlan>["plan"]; dropped: string[]; requested: number; usage: { inputTokens?: number; outputTokens?: number } };
    let meta: RunMeta;

    try {
        const result = await runWithFallback(
            attemptsFor(async (provider, signal) => {
                const { output, usage } = await generateText({
                    model: provider.model,
                    system: DESIGN_SYSTEM_PROMPT + VISION_ADDENDUM,
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: `Current canvas:\n${describeGraph(graph)}\n\nRequest: ${prompt}` },
                                { type: "image", image: image.bytes, mediaType: image.mediaType },
                            ],
                        },
                    ],
                    output: Output.object({ schema: designPlanSchema }),
                    providerOptions: provider.providerOptions,
                    abortSignal: signal,
                    maxRetries: 0,
                    temperature: 0.2,
                    maxOutputTokens: 8000,
                });
                const requested = output.operations.length;
                const { plan, dropped } = repairPlan(graph, { ...output, operations: output.operations.slice(0, MAX_DESIGN_OPERATIONS) });
                return { plan, dropped, requested, usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } };
            }, chain),
            { signal: options.signal, validate: (result) => assertPlanQuality(graph, result.plan, result.requested) }
        );
        value = result.value;
        meta = result.meta;
        void recordCircuitBreakerAttempts(meta.attempts);
    } catch (error) {
        if (error instanceof AllProvidersFailedError) {
            void recordCircuitBreakerAttempts(error.attempts);
        }
        throw error;
    }

    return { plan: value.plan, meta, usage: value.usage, dropped: value.dropped };
};
