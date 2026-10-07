import API from "@/lib/api";
import type { SuccessResponse } from "@/types";
import type { AiRunStarted, AiRunToken, DesignRequestSchema, SpecRequestSchema } from "@repo/types";

export const startDesign = async (data: DesignRequestSchema): Promise<SuccessResponse<AiRunStarted>> => {
    const response = await API.post<SuccessResponse<AiRunStarted>>("/ai/design", data);
    return response.data;
};

export const startSpec = async (data: SpecRequestSchema): Promise<SuccessResponse<AiRunStarted>> => {
    const response = await API.post<SuccessResponse<AiRunStarted>>("/ai/spec", data);
    return response.data;
};

// A fresh read-only token for one of the caller's own runs (the one from `start*` expires after an hour).
export const getRunToken = async (runId: string): Promise<SuccessResponse<AiRunToken>> => {
    const response = await API.post<SuccessResponse<AiRunToken>>(`/ai/runs/${runId}/token`);
    return response.data;
};
