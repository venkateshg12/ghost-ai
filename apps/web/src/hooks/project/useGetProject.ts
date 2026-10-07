import { getProject } from "@/api/project";
import { useAuthStore } from "@/store/auth.store";
import type { ApiError, SuccessResponse } from "@/types";
import type { ProjectSummary } from "@repo/types";
import { useQuery } from "@tanstack/react-query";

// The workspace's access check: a 403/404 here is what renders the AccessDenied screen.
export const useGetProject = (projectId: string) => {
    const user = useAuthStore((state) => state.user);

    return useQuery<SuccessResponse<ProjectSummary>, ApiError, ProjectSummary>({
        queryKey: ["project", projectId],
        queryFn: () => getProject(projectId),
        select: (response) => response.data,
        enabled: Boolean(user && projectId),
        retry: false,
    });
};
