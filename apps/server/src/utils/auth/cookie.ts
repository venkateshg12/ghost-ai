import type { CookieParams } from "@repo/types";
import type { CookieOptions, Response } from "express";
import { AUTH_COOKIE_SAMESITE, NODE_ENV, REFRESH_COOKIE_PATH } from "../../constants/env";
import { fifteenMinutesFromNow, thirtyDaysFromNow } from "../date/date";

const secure = NODE_ENV !== "development";
// The refresh ROUTE, as this API sees it (the error handler matches on it).
export const REFRESH_PATH = "/auth/refresh";

const defaults: CookieOptions = {
    sameSite: AUTH_COOKIE_SAMESITE,
    httpOnly: true,
    // SameSite=None is only valid together with Secure.
    secure: secure || AUTH_COOKIE_SAMESITE === "none",
};

export const getAccessTokenCookieOptions = (): CookieOptions => ({
    ...defaults,
    expires: fifteenMinutesFromNow()
});

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
    ...defaults,
    expires: thirtyDaysFromNow(),
    // The path the browser sees, which differs from REFRESH_PATH when the API sits behind a prefix proxy.
    path: REFRESH_COOKIE_PATH
});

export const setAuthCookies = ({ res, accessToken, refreshToken }: CookieParams) =>
    res.cookie("accessToken", accessToken, getAccessTokenCookieOptions()).cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions());

export const clearAuthCookies = (res: Response) =>
    res.clearCookie("accessToken").clearCookie("refreshToken", { ...defaults, path: REFRESH_COOKIE_PATH });
