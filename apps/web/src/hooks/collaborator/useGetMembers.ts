import { getMembers } from "@/api/project";
import type { ApiError, SuccessResponse } from "@/types";
import type { ProjectMembers } from "@repo/types";
import { useQuery } from "@tanstack/react-query";

export const useGetMembers = (projectId: string | undefined, enabled = true) => {
    return useQuery<SuccessResponse<ProjectMembers>, ApiError, ProjectMembers>({
        queryKey: ["members", projectId],
        queryFn: () => getMembers(projectId!),
        select: (response) => response.data,
        enabled: Boolean(projectId) && enabled,
    });
};
