import { Suspense, type ReactNode } from "react";
import AuthShell from "@/components/auth/AuthShell";
import PublicRoute from "@/components/auth/PublicRoute";
import FullScreenLoader from "@/components/common/FullScreenLoader";

// Guest-only pages. PublicRoute reads `?from=`, so it renders inside a Suspense boundary.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <PublicRoute>
        <AuthShell>{children}</AuthShell>
      </PublicRoute>
    </Suspense>
  );
}
