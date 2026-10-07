import { inviteCollaboratorSchema, projectIdSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { CREATED, OK } from "../constants/http";
import { ok } from "../utils/api/apiEnvelope";
import {
    inviteCollaboratorService,
    listMembersService,
    removeCollaboratorService,
} from "../services/collaborator.service";

export const listCollaboratorsHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const members = await listMembersService(projectId, req.userId);
    return res.status(OK).json(ok(members));
});

export const inviteCollaboratorHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const { email } = inviteCollaboratorSchema.parse(req.body);
    const members = await inviteCollaboratorService(projectId, req.userId, email);
    return res.status(CREATED).json(ok(members));
});

export const removeCollaboratorHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const { email } = inviteCollaboratorSchema.parse({ email: req.params.email });
    const members = await removeCollaboratorService(projectId, req.userId, email);
    return res.status(OK).json(ok(members));
});
