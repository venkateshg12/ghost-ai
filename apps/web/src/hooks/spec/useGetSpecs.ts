import { getSpecs } from "@/api/project";
import type { ApiError, SuccessResponse } from "@/types";
import type { ProjectSpecSummary } from "@repo/types";
import { useQuery } from "@tanstack/react-query";

export const useGetSpecs = (projectId: string) => {
    return useQuery<SuccessResponse<ProjectSpecSummary[]>, ApiError, ProjectSpecSummary[]>({
        queryKey: ["specs", projectId],
        queryFn: () => getSpecs(projectId),
        select: (response) => response.data,
        enabled: Boolean(projectId),
    });
};
