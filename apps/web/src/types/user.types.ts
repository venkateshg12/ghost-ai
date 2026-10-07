export type UserRole = "user" | "admin";

export interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  verified: boolean;
  avatar?: string | null;
  authProvider: "local" | "google";
  googleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AppUser = {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
};
