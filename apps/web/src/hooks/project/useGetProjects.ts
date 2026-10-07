import { getProjects } from "@/api/project";
import { useAuthStore } from "@/store/auth.store";
import type { ApiError, SuccessResponse } from "@/types";
import type { ProjectSummary } from "@repo/types";
import { useQuery } from "@tanstack/react-query";

export const useGetProjects = () => {
    const user = useAuthStore((state) => state.user);

    return useQuery<SuccessResponse<ProjectSummary[]>, ApiError, ProjectSummary[]>({
        queryKey: ["projects"],
        queryFn: getProjects,
        select: (response) => response.data,
        enabled: Boolean(user),
    });
};
