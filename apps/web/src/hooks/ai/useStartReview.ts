import { startReview } from "@/api/ai";
import type { ApiError, SuccessResponse } from "@/types";
import type { AiRunStarted, ReviewRequestSchema } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useStartReview = () =>
  useMutation<SuccessResponse<AiRunStarted>, ApiError, ReviewRequestSchema>({
    mutationFn: startReview,
  });
