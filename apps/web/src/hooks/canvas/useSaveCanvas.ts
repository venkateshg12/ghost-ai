import { saveCanvas } from "@/api/project";
import type { ApiError, SuccessResponse } from "@/types";
import type { CanvasSnapshot } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useSaveCanvas = () => {
    return useMutation<SuccessResponse<{ savedAt: string }>, ApiError, { projectId: string; snapshot: CanvasSnapshot }>({
        mutationFn: saveCanvas,
    });
};
