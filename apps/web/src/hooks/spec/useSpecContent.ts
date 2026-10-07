import { getSpecContent } from "@/api/project";
import type { ApiError, SuccessResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";

type SpecContent = { fileName: string; content: string };

// Fetched only while the preview is open, and never kept long: specs can be large.
export const useSpecContent = (projectId: string, specId: string | null) => {
    return useQuery<SuccessResponse<SpecContent>, ApiError, SpecContent>({
        queryKey: ["spec", projectId, specId],
        queryFn: () => getSpecContent({ projectId, specId: specId! }),
        select: (response) => response.data,
        enabled: Boolean(projectId && specId),
        gcTime: 60 * 1000,
    });
};
