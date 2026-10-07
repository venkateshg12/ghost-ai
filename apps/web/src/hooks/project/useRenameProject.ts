import { renameProject } from "@/api/project";
import queryClient from "@/lib/queryClient";
import type { ApiError, SuccessResponse } from "@/types";
import type { ProjectSummary } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useRenameProject = () => {
    return useMutation<SuccessResponse<ProjectSummary>, ApiError, { projectId: string; name: string }>({
        mutationFn: renameProject,
        onSuccess: (response) => {
            const project = response.data;
            queryClient.setQueryData<SuccessResponse<ProjectSummary[]>>(["projects"], (previous) =>
                previous
                    ? { ...previous, data: previous.data.map((item) => (item.id === project.id ? project : item)) }
                    : previous
            );
            queryClient.setQueryData(["project", project.id], response);
        },
    });
};
