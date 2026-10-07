import type { User, AppUser } from "./user.types";

export interface RegisterResponse {
  title: string;
  message: string;
}

export interface LoginResponse {
  user: User;
  message: string;
}

export interface ProfileResponse {
  user: User;
}

export interface MessageResponse {
  message: string;
}

export type AuthStatus = "idle" | "loading" | "ready" | "error";

export type AuthStore = {
  status: AuthStatus;
  isBootstrapped: boolean;
  user: AppUser | null;
  error: string | null;

  setLoading: () => void;
  setUser: (user: AppUser | null) => void;
  setError: (message: string) => void;
  clearAuth: () => void;
};

/*
  One signed-in device, as GET /session returns it. `isCurrent` marks the session making the
  request, which the UI must not offer to revoke like the others — that is a logout.
 */
export interface SessionSummary {
  id: string;
  userAgent?: string | null;
  createdAt: string;
  isCurrent: boolean;
}
