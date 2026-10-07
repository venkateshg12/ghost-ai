import crypto from "crypto";
import type { ProjectSpecSummary } from "@repo/types";
import { orm } from "../prisma/db";
import type { Models } from "../prisma/contract";
import appAssert from "../utils/errors/appAssert";
import { NOT_FOUND } from "../constants/http";
import { putText, readText, storagePaths } from "../utils/storage";
import { assertProjectAccess } from "./project.service";

const toSpecSummary = (spec: Omit<Models.public_ProjectSpec, "project">): ProjectSpecSummary => ({
    id: spec.id,
    projectId: spec.projectId,
    fileName: spec.fileName,
    createdAt: spec.createdAt,
});

export const listSpecsService = async (projectId: string, userId: string) => {
    await assertProjectAccess(projectId, userId);
    const specs = await orm.ProjectSpec
        .where({ projectId })
        .orderBy((s) => s.createdAt.desc())
        .all();
    return specs.map(toSpecSummary);
};

/*
  Spec content is only ever served through here, after the access check — the client never sees the
  storage reference, so a private blob can't leak by its URL.
 */
export const getSpecContentService = async (projectId: string, specId: string, userId: string) => {
    await assertProjectAccess(projectId, userId);

    const spec = await orm.ProjectSpec.where({ id: specId, projectId }).first();
    appAssert(spec, NOT_FOUND, "Spec not found");

    const content = await readText(spec.filePath);
    appAssert(content !== null, NOT_FOUND, "Spec file is no longer available");

    return { fileName: spec.fileName, content };
};

// Called by the spec job once the Markdown exists: content to storage first, then the metadata row.
export const createSpecRecord = async (projectId: string, projectName: string, markdown: string) => {
    const specId = crypto.randomUUID();
    const filePath = await putText(storagePaths.spec(projectId, specId), markdown, "text/markdown; charset=utf-8");

    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    const base = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project";
    const spec = await orm.ProjectSpec.create({
        id: specId,
        projectId,
        filePath,
        fileName: `${base}-spec-${stamp}.md`,
    });

    return toSpecSummary(spec);
};
