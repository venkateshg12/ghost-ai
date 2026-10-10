import { applyFix } from "@/api/ai";
import type { ApiError, SuccessResponse } from "@/types";
import type { ApplyFixRequestSchema } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useApplyFix = () =>
  useMutation<
    SuccessResponse<{ applied: number; runId: string }>,
    ApiError,
    ApplyFixRequestSchema
  >({
    mutationFn: applyFix,
  });
