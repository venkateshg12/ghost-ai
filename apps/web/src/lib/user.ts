import type { AppUser, User } from "@/types";

// The server's user row -> the slim shape the auth store keeps.
export const toAppUser = (user: User): AppUser => ({
  id: user.id,
  email: user.email,
  name: user.name || user.email.split("@")[0] || "User",
  avatar: user.avatar ?? undefined,
  role: user.role,
});
