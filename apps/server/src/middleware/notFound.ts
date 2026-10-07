import { NOT_FOUND } from "../constants/http";
import { Request, Response } from "express";
import { fail } from "../utils/api/apiEnvelope";

export function notFound(req: Request, res: Response) {
    res.status(NOT_FOUND).json(fail(`Route not Found: ${req.method} ${req.originalUrl}`));
}