import { z } from "zod";

// Project ids double as realtime room ids, so every route that takes one validates it the same way.
export const projectIdSchema = z.string().uuid({ message: "Invalid project id" });

// Owned projects per account. Projects shared with a user don't count towards it.
export const MAX_PROJECTS_PER_USER = 5;
export const PROJECT_LIMIT_ERROR_CODE = "PROJECT_LIMIT_REACHED";

const projectNameField = z.string().trim().min(1, { message: "Project name is required" }).max(120);

// A missing or blank name is not an error: the project is created as "Untitled Project".
export const createProjectSchema = z.object({
    name: z.string().trim().max(120).optional(),
    description: z.string().trim().max(500).optional(),
});
export type CreateProjectSchema = z.infer<typeof createProjectSchema>;

export const renameProjectSchema = z.object({
    name: projectNameField,
});
export type RenameProjectSchema = z.infer<typeof renameProjectSchema>;

export const inviteCollaboratorSchema = z.object({
    email: z.string().trim().toLowerCase().email({ message: "Enter a valid email address" }).max(255),
});
export type InviteCollaboratorSchema = z.infer<typeof inviteCollaboratorSchema>;

export type ProjectRole = "owner" | "collaborator";
export type ProjectStatus = "DRAFT" | "ARCHIVED";

export interface ProjectSummary {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: ProjectStatus;
    role: ProjectRole;
    createdAt: string;
    updatedAt: string;
}

export interface ProjectMember {
    email: string;
    displayName: string;
    avatarUrl: string;
}

export interface ProjectCollaboratorSummary extends ProjectMember {
    id: string;
    createdAt: string;
}

export interface ProjectMembers {
    owner: ProjectMember;
    collaborators: ProjectCollaboratorSummary[];
}

export interface ProjectSpecSummary {
    id: string;
    projectId: string;
    fileName: string;
    createdAt: string;
}

// "Event Driven System!" -> "event-driven-system". Display-only; the project id is the room id.
export const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_]+/g, "-")
        .replace(/^-+|-+$/g, "");
