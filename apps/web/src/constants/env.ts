import { AppError } from "@/utils/appError";

/*
  NEXT_PUBLIC_* values are inlined at build time, and only when read as literal `process.env.X`
  expressions — so each one is read explicitly here rather than through a dynamic lookup.
 */
const requireEnv = (key: string, value: string | undefined) => {
    if (!value) {
        throw new AppError(`Missing environment variable ${key}`);
    }
    return value;
};

export const IS_DEV = process.env.NODE_ENV === "development";
export const API_URL = requireEnv("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL);
// Optional: without it the Google button is simply not shown.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
