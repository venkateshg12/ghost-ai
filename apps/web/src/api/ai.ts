import API from "@/lib/api";
import type { SuccessResponse } from "@/types";
import type {
  AiRunStarted,
  AiRunToken,
  AiUsageSummary,
  ApplyFixRequestSchema,
  DesignRequestSchema,
  ReviewRequestSchema,
  SpecRequestSchema,
} from "@repo/types";

export const startDesign = async (
  data: DesignRequestSchema,
): Promise<SuccessResponse<AiRunStarted>> => {
  const response = await API.post<SuccessResponse<AiRunStarted>>(
    "/ai/design",
    data,
  );
  return response.data;
};

export const startSpec = async (
  data: SpecRequestSchema,
): Promise<SuccessResponse<AiRunStarted>> => {
  const response = await API.post<SuccessResponse<AiRunStarted>>(
    "/ai/spec",
    data,
  );
  return response.data;
};

// A fresh read-only token for one of the caller's own runs (the one from `start*` expires after an hour).
export const getRunToken = async (
  runId: string,
): Promise<SuccessResponse<AiRunToken>> => {
  const response = await API.post<SuccessResponse<AiRunToken>>(
    `/ai/runs/${runId}/token`,
  );
  return response.data;
};

// Stop a run that is still going. Allowed for whoever started it and for the project owner.
export const cancelRun = async (
  runId: string,
): Promise<SuccessResponse<{ cancelled: boolean }>> => {
  const response = await API.post<SuccessResponse<{ cancelled: boolean }>>(
    `/ai/runs/${runId}/cancel`,
  );
  return response.data;
};

// Put the canvas back as it was before this run. Only the most recent AI change can be undone.
export const revertRun = async (
  runId: string,
): Promise<SuccessResponse<{ reverted: boolean }>> => {
  const response = await API.post<SuccessResponse<{ reverted: boolean }>>(
    `/ai/runs/${runId}/revert`,
  );
  return response.data;
};

export const getAiUsage = async (
  projectId: string,
): Promise<SuccessResponse<AiUsageSummary>> => {
  const response = await API.get<SuccessResponse<AiUsageSummary>>(
    `/ai/usage/${projectId}`,
  );
  return response.data;
};

export const startReview = async (
  data: ReviewRequestSchema,
): Promise<SuccessResponse<AiRunStarted>> => {
  const response = await API.post<SuccessResponse<AiRunStarted>>(
    "/ai/review",
    data,
  );
  return response.data;
};

// Apply one recommendation of a review. Only ids go up; the server reads the edits back from the room.
export const applyFix = async (
  data: ApplyFixRequestSchema,
): Promise<SuccessResponse<{ applied: number; runId: string }>> => {
  const response = await API.post<
    SuccessResponse<{ applied: number; runId: string }>
  >("/ai/review/apply", data);
  return response.data;
};

/*
  Sketch to diagram. The image is the request body (raw bytes, with its own content type); the room and the
  optional instruction travel in the query string. The server checks the bytes, not the declared type.
 */
export const startImageDesign = async ({
  roomId,
  file,
  prompt,
}: {
  roomId: string;
  file: File;
  prompt?: string;
}): Promise<SuccessResponse<AiRunStarted>> => {
  const response = await API.post<SuccessResponse<AiRunStarted>>(
    "/ai/design-from-image",
    file,
    {
      params: { roomId, ...(prompt ? { prompt } : {}) },
      headers: { "Content-Type": file.type },
      // A few MB over a slow connection.
      timeout: 60_000,
    },
  );
  return response.data;
};
