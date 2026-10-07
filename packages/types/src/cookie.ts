import type { Response } from "express";

export type CookieParams = {
    res: Response,
    accessToken: string,
    refreshToken: string
}