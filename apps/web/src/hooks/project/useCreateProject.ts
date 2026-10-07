import { createProject } from "@/api/project";
import queryClient from "@/lib/queryClient";
import type { ApiError, SuccessResponse } from "@/types";
import type { CreateProjectSchema, ProjectSummary } from "@repo/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const useCreateProject = () => {
    const router = useRouter();

    return useMutation<SuccessResponse<ProjectSummary>, ApiError, CreateProjectSchema>({
        mutationFn: createProject,
        onSuccess: (response) => {
            const project = response.data;
            queryClient.setQueryData<SuccessResponse<ProjectSummary[]>>(["projects"], (previous) =>
                previous ? { ...previous, data: [project, ...previous.data] } : previous
            );
            queryClient.setQueryData(["project", project.id], response);
            router.push(`/editor/${project.id}`);
        },
    });
};
