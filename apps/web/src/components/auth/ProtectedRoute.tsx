"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import ServerWakeLoader from "@/components/common/ServerWakeLoader";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";

// Signed-in users only. Anyone else is sent to sign in, with the page they wanted remembered.
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isBootstrapped && !user) {
      router.replace(`${ROUTES.signIn}?from=${encodeURIComponent(pathname)}`);
    }
  }, [isBootstrapped, user, router, pathname]);

  if (!isBootstrapped) return <ServerWakeLoader />;
  if (!user) return <FullScreenLoader label="Checking your session…" />;

  return <>{children}</>;
};

export default ProtectedRoute;
