import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GEMINI_MODEL, GOOGLE_GENERATIVE_AI_API_KEY } from "../../constants/env";

const google = GOOGLE_GENERATIVE_AI_API_KEY
    ? createGoogleGenerativeAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY })
    : null;

/**
 * The Gemini model the jobs call, or `null` when no API key is configured — callers then use their
 * deterministic fallback, so the flow is still testable end to end without a key.
 */
export const getGeminiModel = () => (google ? google(GEMINI_MODEL) : null);
