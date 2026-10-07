import { slugify, type CreateProjectSchema, type ProjectRole, type ProjectSummary } from "@repo/types";
import { orm } from "../prisma/db";
import type { Models } from "../prisma/contract";
import appAssert from "../utils/errors/appAssert";
import { FORBIDDEN, NOT_FOUND } from "../constants/http";
import { appErrorCode } from "../constants/appErrorCode";
import { liveblocks } from "../utils/liveblocks";
import { removeObject } from "../utils/storage";

// A queried row has the columns only; the model type also lists its relations.
type Project = Omit<Models.public_Project, "collaborators" | "owner" | "specs">;

const DEFAULT_PROJECT_NAME = "Untitled Project";

export const toProjectSummary = (project: Project, role: ProjectRole): ProjectSummary => ({
    id: project.id,
    name: project.name,
    slug: slugify(project.name),
    description: project.description ?? null,
    status: project.status,
    role,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
});

// Collaborators are stored by email, so access depends on the caller's current address.
const getUserEmail = async (userId: string) => {
    const user = await orm.User.where({ id: userId }).select("email").first();
    appAssert(user, NOT_FOUND, "User not found");
    return user.email;
};

/*
  The one place project access is decided: the owner, or anyone whose account email is on the
  project's collaborator list. Returns `null` for "no such project" and "not yours" alike, so callers
  that only need a yes/no can't accidentally treat the two differently.
 */
export const checkProjectAccess = async (
    projectId: string,
    userId: string
): Promise<{ project: Project; role: ProjectRole } | null> => {
    const project = await orm.Project.where({ id: projectId }).first();
    if (!project) return null;

    if (project.ownerId === userId) {
        return { project, role: "owner" };
    }

    const email = await getUserEmail(userId);
    const membership = await orm.ProjectCollaborator
        .where({ projectId, email })
        .select("id")
        .first();

    return membership ? { project, role: "collaborator" } : null;
};

/** Throws 404 for a missing project and 403 for one the caller can't open. */
export const assertProjectAccess = async (projectId: string, userId: string) => {
    const exists = await orm.Project.where({ id: projectId }).select("id").first();
    appAssert(exists, NOT_FOUND, "Project not found");

    const access = await checkProjectAccess(projectId, userId);
    appAssert(access, FORBIDDEN, "You don't have access to this project", appErrorCode.Forbidden);
    return access;
};

/** Owner-only mutations (rename, delete, manage collaborators). */
export const assertProjectOwner = async (projectId: string, userId: string) => {
    const project = await orm.Project.where({ id: projectId }).first();
    appAssert(project, NOT_FOUND, "Project not found");
    appAssert(project.ownerId === userId, FORBIDDEN, "Only the project owner can do that", appErrorCode.Forbidden);
    return project;
};

export const listProjectsService = async (userId: string): Promise<ProjectSummary[]> => {
    const email = await getUserEmail(userId);

    const [owned, memberships] = await Promise.all([
        orm.Project
            .where({ ownerId: userId })
            .orderBy((p) => p.createdAt.desc())
            .all(),
        orm.ProjectCollaborator
            .where({ email })
            .select("projectId")
            .all(),
    ]);

    const sharedIds = memberships.map((membership) => membership.projectId);
    const shared = sharedIds.length
        ? await orm.Project
              .where((p) => p.id.in(sharedIds))
              .orderBy((p) => p.createdAt.desc())
              .all()
        : [];

    return [
        ...owned.map((project) => toProjectSummary(project, "owner")),
        // A user can't be a collaborator on their own project, but an owner's old invite could linger.
        ...shared
            .filter((project) => project.ownerId !== userId)
            .map((project) => toProjectSummary(project, "collaborator")),
    ];
};

export const getProjectService = async (projectId: string, userId: string) => {
    const { project, role } = await assertProjectAccess(projectId, userId);
    return toProjectSummary(project, role);
};

export const createProjectService = async (userId: string, data: CreateProjectSchema) => {
    const project = await orm.Project.create({
        ownerId: userId,
        name: data.name || DEFAULT_PROJECT_NAME,
        description: data.description || null,
    });
    return toProjectSummary(project, "owner");
};

export const renameProjectService = async (projectId: string, userId: string, name: string) => {
    await assertProjectOwner(projectId, userId);

    const project = await orm.Project
        .where({ id: projectId })
        .update({ name, updatedAt: new Date().toISOString() });
    appAssert(project, NOT_FOUND, "Project not found");

    return toProjectSummary(project, "owner");
};

/*
  The row delete cascades to collaborators, specs and task runs. The artifacts they point at live
  outside Postgres, so they're collected first and removed afterwards — best effort, because a stray
  blob costs a few bytes while a failed delete would leave the user with a project they can't remove.
 */
export const deleteProjectService = async (projectId: string, userId: string) => {
    const project = await assertProjectOwner(projectId, userId);
    const specs = await orm.ProjectSpec.where({ projectId }).select("filePath").all();

    await orm.Project.where({ id: projectId }).delete();

    const references = [
        ...(project.canvasJsonPath ? [project.canvasJsonPath] : []),
        ...specs.map((spec) => spec.filePath),
    ];
    const cleanup = await Promise.allSettled([
        ...references.map((reference) => removeObject(reference)),
        liveblocks.deleteRoom(projectId),
    ]);
    for (const result of cleanup) {
        if (result.status === "rejected") {
            console.warn(`[project] cleanup after deleting ${projectId} failed:`, result.reason);
        }
    }
};

