import { concurrencyLimit } from "@trigger.dev/sdk";

// Each project gets its own pool of 1, shared by Build, Ask, Review, Spec and Sketch.
export const projectLimit = concurrencyLimit({ name: "ai-per-project", perKey: 1 });

// At most this many AI runs execute at once, across every project and task. Tune to your NVIDIA/Gemini quotas.
export const globalLimit = concurrencyLimit({ name: "ai-global", total: 4 });
