import API from "@/lib/api";
import type { MessageResponse, SuccessResponse } from "@/types";
import type {
    CreateProjectSchema,
    ProjectMembers,
    ProjectSpecSummary,
    ProjectSummary,
} from "@repo/types";

export const getProjects = async (): Promise<SuccessResponse<ProjectSummary[]>> => {
    const response = await API.get<SuccessResponse<ProjectSummary[]>>("/projects");
    return response.data;
};

export const getProject = async (projectId: string): Promise<SuccessResponse<ProjectSummary>> => {
    const response = await API.get<SuccessResponse<ProjectSummary>>(`/projects/${projectId}`);
    return response.data;
};

export const createProject = async (data: CreateProjectSchema): Promise<SuccessResponse<ProjectSummary>> => {
    const response = await API.post<SuccessResponse<ProjectSummary>>("/projects", data);
    return response.data;
};

export const renameProject = async ({ projectId, name }: { projectId: string; name: string }): Promise<SuccessResponse<ProjectSummary>> => {
    const response = await API.patch<SuccessResponse<ProjectSummary>>(`/projects/${projectId}`, { name });
    return response.data;
};

export const deleteProject = async (projectId: string): Promise<SuccessResponse<MessageResponse>> => {
    const response = await API.delete<SuccessResponse<MessageResponse>>(`/projects/${projectId}`);
    return response.data;
};

/* ---------- Collaborators ---------- */

export const getMembers = async (projectId: string): Promise<SuccessResponse<ProjectMembers>> => {
    const response = await API.get<SuccessResponse<ProjectMembers>>(`/projects/${projectId}/collaborators`);
    return response.data;
};

export const inviteCollaborator = async ({ projectId, email }: { projectId: string; email: string }): Promise<SuccessResponse<ProjectMembers>> => {
    const response = await API.post<SuccessResponse<ProjectMembers>>(`/projects/${projectId}/collaborators`, { email });
    return response.data;
};

export const removeCollaborator = async ({ projectId, email }: { projectId: string; email: string }): Promise<SuccessResponse<ProjectMembers>> => {
    const response = await API.delete<SuccessResponse<ProjectMembers>>(
        `/projects/${projectId}/collaborators/${encodeURIComponent(email)}`
    );
    return response.data;
};

/* ---------- Canvas ---------- */


/* ---------- Specs ---------- */

export const getSpecs = async (projectId: string): Promise<SuccessResponse<ProjectSpecSummary[]>> => {
    const response = await API.get<SuccessResponse<ProjectSpecSummary[]>>(`/projects/${projectId}/specs`);
    return response.data;
};

export const getSpecContent = async ({ projectId, specId }: { projectId: string; specId: string }): Promise<SuccessResponse<{ fileName: string; content: string }>> => {
    const response = await API.get<SuccessResponse<{ fileName: string; content: string }>>(`/projects/${projectId}/specs/${specId}`);
    return response.data;
};

export const specDownloadPath = (projectId: string, specId: string) => `/projects/${projectId}/specs/${specId}/download`;
