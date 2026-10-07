import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors/appError";
import { fail } from "../utils/api/apiEnvelope";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from "../constants/http";
import z from "zod";
import { clearAuthCookies, REFRESH_PATH } from "../utils/auth/cookie";

const handleZodError = (res: Response, error: z.ZodError) => {
    const errors = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
    }))
    return res.status(BAD_REQUEST).json({ status: "error", data: null, errors });
}

export function errorHandler(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
) {
    if (error instanceof z.ZodError) {
        return handleZodError(res, error)
    }

    if(_req.path ===  REFRESH_PATH) {
        clearAuthCookies(res);
    }
    if (error instanceof AppError) {
        return res.status(error.statusCode).json(fail(error.message, error.errorCode ?? "APP_ERROR"));
    }
    console.error("error", error);

    return res.status(INTERNAL_SERVER_ERROR).json(fail("Internal Server Error", "INTERNAL_SERVER_ERROR"));
}