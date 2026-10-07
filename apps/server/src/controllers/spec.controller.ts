import z from "zod";
import { projectIdSchema } from "@repo/types";
import { catchError } from "../utils/errors/catchError";
import { OK } from "../constants/http";
import { ok } from "../utils/api/apiEnvelope";
import { getSpecContentService, listSpecsService } from "../services/spec.service";

const specIdSchema = z.string().uuid({ message: "Invalid spec id" });

export const listSpecsHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const specs = await listSpecsService(projectId, req.userId);
    return res.status(OK).json(ok(specs));
});

// JSON for the in-app preview.
export const getSpecHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const specId = specIdSchema.parse(req.params.specId);
    const spec = await getSpecContentService(projectId, specId, req.userId);
    return res.status(OK).json(ok(spec));
});

// The raw Markdown as an attachment, so the browser saves it as a file.
export const downloadSpecHandler = catchError(async (req, res) => {
    const projectId = projectIdSchema.parse(req.params.projectId);
    const specId = specIdSchema.parse(req.params.specId);
    const { fileName, content } = await getSpecContentService(projectId, specId, req.userId);

    return res
        .status(OK)
        .type("text/markdown; charset=utf-8")
        .attachment(fileName)
        .send(content);
});
