"use client";

import { useEffect, type ReactNode } from "react";
import ServerWakeLoader from "@/components/common/ServerWakeLoader";
import { useGetProfile } from "@/hooks/auth/useGetProfile";
import { clearUserQueries } from "@/lib/queryClient";
import { toAppUser } from "@/lib/user";
import { useAuthStore } from "@/store/auth.store";

/*
  Resolves "who is signed in" once per page load, from the cookie session, and records the answer in
  the auth store. Pages don't render until it has an answer, so the guards below never flash the
  wrong screen. The splash is the same dark shell the editor uses.
 */
const AuthLoader = ({ children }: { children: ReactNode }) => {
  const { data, isSuccess, isError } = useGetProfile();
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);

  useEffect(() => {
    if (isSuccess && data?.data?.user) {
      setUser(toAppUser(data.data.user));
    } else if (isError || (isSuccess && !data)) {
      clearAuth();
      // No session resolved on this load — anything cached for a previous one goes with it.
      clearUserQueries();
    }
  }, [isSuccess, isError, data, setUser, clearAuth]);

  // A sleeping free-tier API can take up to a minute to answer; the loader says so instead of looking frozen.
  if (!isBootstrapped) return <ServerWakeLoader />;

  return <>{children}</>;
};

export default AuthLoader;
