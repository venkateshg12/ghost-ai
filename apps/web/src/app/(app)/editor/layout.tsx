import type { ReactNode } from "react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

// Saved projects are private to their members. The canvas at `/` is the only place open to everyone.
export default function Layout({ children }: { children: ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
