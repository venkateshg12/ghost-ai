import { inviteCollaborator } from "@/api/project";
import queryClient from "@/lib/queryClient";
import type { ApiError, SuccessResponse } from "@/types";
import type { ProjectMembers } from "@repo/types";
import { useMutation } from "@tanstack/react-query";

export const useInviteCollaborator = () => {
    return useMutation<SuccessResponse<ProjectMembers>, ApiError, { projectId: string; email: string }>({
        mutationFn: inviteCollaborator,
        // The server answers with the updated member list, so it replaces the cached one directly.
        onSuccess: (response, { projectId }) => {
            queryClient.setQueryData(["members", projectId], response);
        },
    });
};
