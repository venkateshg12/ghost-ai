import { MAX_PROJECTS_PER_USER, slugify, type CreateProjectSchema, type ProjectRole, type ProjectSummary } from "@repo/types";
import { orm } from "../prisma/db";
import type { Models } from "../prisma/contract";
import appAssert from "../utils/errors/appAssert";
import { FORBIDDEN, NOT_FOUND } from "../constants/http";
import { appErrorCode } from "../constants/appErrorCode";
import { referenceFor, removeObject, storagePaths } from "../utils/storage";
import { roomManager } from "../realtime/roomManager";

// A queried row has the columns only; the model type also lists its relations.
type Project = Omit<Models.public_Project, "collaborators" | "owner" | "specs" | "messages">;


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

const projectLimitMessage = `You can have up to ${MAX_PROJECTS_PER_USER} projects. Delete one to create another.`;

// Oldest first: when the limit is breached, the newest row is the one that loses.
const listOwnedProjectIds = async (userId: string) => {
    const rows = await orm.Project
        .where({ ownerId: userId })
        .orderBy((p) => p.createdAt.asc())
        .select("id")
        .all();
    return rows.map((row) => row.id);
};

/*
  Capped at MAX_PROJECTS_PER_USER owned projects. The pre-check gives the normal fast failure; the
  re-check after the insert closes the race where two requests both pass the pre-check — whichever
  row ended up past the limit is removed again.
 */
export const createProjectService = async (userId: string, data: CreateProjectSchema) => {
    const before = await listOwnedProjectIds(userId);
    appAssert(before.length < MAX_PROJECTS_PER_USER, FORBIDDEN, projectLimitMessage, appErrorCode.ProjectLimitReached);

    const project = await orm.Project.create({
        ownerId: userId,
        name: data.name || DEFAULT_PROJECT_NAME,
        description: data.description || null,
    });

    const after = await listOwnedProjectIds(userId);
    if (!after.slice(0, MAX_PROJECTS_PER_USER).includes(project.id)) {
        await orm.Project.where({ id: project.id }).delete();
        appAssert(false, FORBIDDEN, projectLimitMessage, appErrorCode.ProjectLimitReached);
    }

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
        referenceFor(storagePaths.roomDoc(projectId)),
        ...specs.map((spec) => spec.filePath),
    ];
    const cleanup = await Promise.allSettled([
        ...references.map((reference) => removeObject(reference)),
        roomManager.destroyRoom(projectId),
    ]);
    for (const result of cleanup) {
        if (result.status === "rejected") {
            console.warn(`[project] cleanup after deleting ${projectId} failed:`, result.reason);
        }
    }
};


