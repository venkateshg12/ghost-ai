import type { InternalAxiosRequestConfig } from "axios";

export interface SuccessResponse<T> {
  status: "success";
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorDetail {
  path?: string; // field this error belongs to (e.g. for Zod validation errors)
  message: string;
  code?: string;
}

/**
 * The single error shape every request rejects with. The axios interceptor in `lib/api.ts`
 * normalizes server envelopes, network failures and timeouts into this, so callers read
 * `error.message` / `error.code` and never the raw Axios error.
 */
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  errors?: ApiErrorDetail[];
}

export interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export interface QueueItem {
  resolve: () => void;
  reject: (reason: unknown) => void;
}
