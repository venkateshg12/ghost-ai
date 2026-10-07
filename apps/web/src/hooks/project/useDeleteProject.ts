import { deleteProject } from "@/api/project";
import queryClient from "@/lib/queryClient";
import type { ApiError, MessageResponse, SuccessResponse } from "@/types";
import type { ProjectSummary } from "@repo/types";
import { useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";

export const useDeleteProject = () => {
    const router = useRouter();
    const params = useParams<{ roomId?: string }>();

    return useMutation<SuccessResponse<MessageResponse>, ApiError, string>({
        mutationFn: deleteProject,
        onSuccess: (_response, projectId) => {
            queryClient.setQueryData<SuccessResponse<ProjectSummary[]>>(["projects"], (previous) =>
                previous ? { ...previous, data: previous.data.filter((item) => item.id !== projectId) } : previous
            );
            queryClient.removeQueries({ queryKey: ["project", projectId] });
            // Deleting the workspace you're standing in sends you home; anywhere else, stay put.
            if (params.roomId === projectId) {
                router.replace("/editor");
            }
        },
    });
};
