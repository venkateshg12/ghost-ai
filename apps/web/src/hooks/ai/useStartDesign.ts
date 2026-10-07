import { startDesign } from "@/api/ai";
import type { ApiError, SuccessResponse } from "@/types";
import type { AiRunStarted, DesignRequestSchema } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useStartDesign = () => {
    return useMutation<SuccessResponse<AiRunStarted>, ApiError, DesignRequestSchema>({
        mutationFn: startDesign,
    });
};
