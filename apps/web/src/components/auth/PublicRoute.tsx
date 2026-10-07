"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { useAuthStore } from "@/store/auth.store";

// Only an in-app path is honoured, so `?from=` can't be used to bounce users to another site.
const safeRedirect = (from: string | null) =>
  from && from.startsWith("/") && !from.startsWith("//") ? from : "/editor";

// Guest-only pages (sign in, sign up, forgot password). A signed-in user is sent on to the editor.
const PublicRoute = ({ children }: { children: ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from");

  useEffect(() => {
    if (isBootstrapped && user) {
      router.replace(safeRedirect(from));
    }
  }, [isBootstrapped, user, router, from]);

  if (!isBootstrapped || user) {
    return <FullScreenLoader />;
  }

  return <>{children}</>;
};

export default PublicRoute;
