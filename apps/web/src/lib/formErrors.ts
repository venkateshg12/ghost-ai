import type { ZodError } from "zod";
import type { ApiError } from "@/types";

export type FieldErrors = Record<string, string>;

// First message per field, keyed by its path ("confirmPassword"), from a failed client-side parse.
export const zodFieldErrors = (error: ZodError): FieldErrors => {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!errors[path]) errors[path] = issue.message;
  }
  return errors;
};

// The same, from the server's 400 — its Zod errors arrive with a `path` per field.
export const apiFieldErrors = (error: ApiError): FieldErrors => {
  const errors: FieldErrors = {};
  for (const detail of error.errors ?? []) {
    if (detail.path && !errors[detail.path]) errors[detail.path] = detail.message;
  }
  return errors;
};
