import { revertRun } from "@/api/ai";
import type { ApiError, SuccessResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";

export const useRevertRun = () =>
  useMutation<SuccessResponse<{ reverted: boolean }>, ApiError, string>({
    mutationFn: revertRun,
  });
