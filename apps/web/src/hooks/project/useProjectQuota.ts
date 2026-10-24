import { MAX_PROJECTS_PER_USER } from "@repo/types";
import { useGetProjects } from "./useGetProjects";

/*
  How many of the account's project slots are used. Only projects you own count — ones shared with you
  don't. The server enforces the same limit; this is what lets the UI say so before the request.
 */
export const useProjectQuota = () => {
    const { data: projects, isLoading } = useGetProjects();
    const used = projects ? projects.filter((project) => project.role === "owner").length : 0;

    return {
        used,
        max: MAX_PROJECTS_PER_USER,
        atLimit: used >= MAX_PROJECTS_PER_USER,
        isLoading,
    };
};
