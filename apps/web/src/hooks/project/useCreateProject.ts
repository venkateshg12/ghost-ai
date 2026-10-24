import { createProject } from "@/api/project";
import { ROUTES } from "@/constants/routes";
import queryClient from "@/lib/queryClient";
import { useEditorStore } from "@/store/editor.store";
import type { ApiError, SuccessResponse } from "@/types";
import { PROJECT_LIMIT_ERROR_CODE, type CreateProjectSchema, type ProjectSummary } from "@repo/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

/*
  `importDraft`: the project is being made from the canvas at `/`, so its drawing is carried over once
  the new project's room opens (see WorkspaceCanvas).
 */
export const useCreateProject = ({ importDraft = false }: { importDraft?: boolean } = {}) => {
    const router = useRouter();
    const setPendingImport = useEditorStore((state) => state.setPendingImport);

    return useMutation<SuccessResponse<ProjectSummary>, ApiError, CreateProjectSchema>({
        mutationFn: createProject,
        onSuccess: (response) => {
            const project = response.data;
            queryClient.setQueryData<SuccessResponse<ProjectSummary[]>>(["projects"], (previous) =>
                previous ? { ...previous, data: [project, ...previous.data] } : previous
            );
            queryClient.setQueryData(["project", project.id], response);
            if (importDraft) setPendingImport({ projectId: project.id });
            router.push(ROUTES.project(project.id));
        },
        onError: (error) => {
            // The server's count is the truth; our cached list was out of date (another tab, a stale page).
            if (error.code === PROJECT_LIMIT_ERROR_CODE) {
                void queryClient.invalidateQueries({ queryKey: ["projects"] });
            }
        },
    });
};
