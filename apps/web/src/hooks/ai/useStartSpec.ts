import { startSpec } from "@/api/ai";
import type { ApiError, SuccessResponse } from "@/types";
import type { AiRunStarted, SpecRequestSchema } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useStartSpec = () => {
  return useMutation<
    SuccessResponse<AiRunStarted>,
    ApiError,
    SpecRequestSchema
  >({
    mutationFn: startSpec,
  });
};
