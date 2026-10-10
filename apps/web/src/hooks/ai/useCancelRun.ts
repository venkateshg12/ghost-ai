import { cancelRun } from "@/api/ai";
import type { ApiError, SuccessResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";

export const useCancelRun = () =>
  useMutation<SuccessResponse<{ cancelled: boolean }>, ApiError, string>({
    mutationFn: cancelRun,
  });
