import type { ProjectCollaboratorSummary, ProjectMember, ProjectMembers } from "@repo/types";
import { orm } from "../prisma/db";
import appAssert from "../utils/errors/appAssert";
import { BAD_REQUEST, CONFLICT, NOT_FOUND } from "../constants/http";
import { cache } from "../utils/cache";
import { assertProjectAccess, assertProjectOwner } from "./project.service";

// The share dialog is opened far more often than the member list changes. Any invite, removal or
// profile edit bumps `members`, so this TTL only bounds how long a missed bump could linger.
const MEMBERS_TTL_SECONDS = 300;

const memberFrom = (email: string, user?: { name: string | null; avatar: string | null }): ProjectMember => ({
    email,
    displayName: user?.name ?? "",
    avatarUrl: user?.avatar ?? "",
});

/*
  Collaborators are stored by email. Names and avatars come from whichever account owns that address,
  if any — an invite sent before the person signed up shows the email alone until they do.
 */
const loadMembers = async (projectId: string, ownerId: string): Promise<ProjectMembers> => {
    const [owner, collaborators] = await Promise.all([
        orm.User.where({ id: ownerId }).select("email", "name", "avatar").first(),
        orm.ProjectCollaborator
            .where({ projectId })
            .orderBy((c) => c.createdAt.asc())
            .all(),
    ]);
    appAssert(owner, NOT_FOUND, "Project owner not found");

    const emails = collaborators.map((collaborator) => collaborator.email);
    const accounts = emails.length
        ? await orm.User.where((u) => u.email.in(emails)).select("email", "name", "avatar").all()
        : [];
    const accountByEmail = new Map(accounts.map((account) => [account.email, account]));

    return {
        owner: memberFrom(owner.email, owner),
        collaborators: collaborators.map(
            (collaborator): ProjectCollaboratorSummary => ({
                id: collaborator.id,
                createdAt: collaborator.createdAt,
                ...memberFrom(collaborator.email, accountByEmail.get(collaborator.email)),
            })
        ),
    };
};

export const listMembersService = async (projectId: string, userId: string) => {
    const { project } = await assertProjectAccess(projectId, userId);
    const key = await cache.versionedKey(["members"], `project:${projectId}`);
    return cache.getOrSet(key, () => loadMembers(projectId, project.ownerId), MEMBERS_TTL_SECONDS);
};

export const inviteCollaboratorService = async (projectId: string, userId: string, email: string) => {
    const project = await assertProjectOwner(projectId, userId);

    const owner = await orm.User.where({ id: project.ownerId }).select("email").first();
    appAssert(owner?.email !== email, BAD_REQUEST, "You already own this project");

    const existing = await orm.ProjectCollaborator.where({ projectId, email }).select("id").first();
    appAssert(!existing, CONFLICT, "That person is already a collaborator");

    await orm.ProjectCollaborator.create({ projectId, email });
    await cache.bump("members");

    return loadMembers(projectId, project.ownerId);
};

export const removeCollaboratorService = async (projectId: string, userId: string, email: string) => {
    const project = await assertProjectOwner(projectId, userId);

    const removed = await orm.ProjectCollaborator.where({ projectId, email }).delete();
    appAssert(removed, NOT_FOUND, "Collaborator not found");
    await cache.bump("members");

    return loadMembers(projectId, project.ownerId);
};
