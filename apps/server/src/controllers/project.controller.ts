import { createProjectSchema, projectIdSchema, renameProjectSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { CREATED, OK } from "../constants/http";
import { ok } from "../utils/api/apiEnvelope";
import {
    createProjectService,
    deleteProjectService,
    getProjectService,
    listProjectsService,
    renameProjectService,
} from "../services/project.service";

export const listProjectsHandler = catchError(async (req, res) => {
    const projects = await listProjectsService(req.userId);
    return res.status(OK).json(ok(projects));
});

export const getProjectHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const project = await getProjectService(projectId, req.userId);
    return res.status(OK).json(ok(project));
});

export const createProjectHandler = catchError(async (req, res) => {
    // An empty body is fine: the project is created as "Untitled Project".
    const data = createProjectSchema.parse(req.body ?? {});
    const project = await createProjectService(req.userId, data);
    return res.status(CREATED).json(ok(project));
});

export const renameProjectHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const { name } = renameProjectSchema.parse(req.body);
    const project = await renameProjectService(projectId, req.userId, name);
    return res.status(OK).json(ok(project));
});

export const deleteProjectHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    await deleteProjectService(projectId, req.userId);
    return res.status(OK).json(ok({ message: "Project deleted" }));
});
