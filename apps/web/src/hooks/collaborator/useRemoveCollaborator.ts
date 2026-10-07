import { removeCollaborator } from "@/api/project";
import queryClient from "@/lib/queryClient";
import type { ApiError, SuccessResponse } from "@/types";
import type { ProjectMembers } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useRemoveCollaborator = () => {
    return useMutation<SuccessResponse<ProjectMembers>, ApiError, { projectId: string; email: string }>({
        mutationFn: removeCollaborator,
        onSuccess: (response, { projectId }) => {
            queryClient.setQueryData(["members", projectId], response);
        },
    });
};
