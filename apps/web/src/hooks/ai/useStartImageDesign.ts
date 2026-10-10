import { startImageDesign } from "@/api/ai";
import type { ApiError, SuccessResponse } from "@/types";
import type { AiRunStarted } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useStartImageDesign = () =>
  useMutation<
    SuccessResponse<AiRunStarted>,
    ApiError,
    { roomId: string; file: File; prompt?: string }
  >({
    mutationFn: startImageDesign,
  });
