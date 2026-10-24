"use client";

import { useEffect, type ReactNode } from "react";
import { useGetProfile } from "@/hooks/auth/useGetProfile";
import { clearUserQueries } from "@/lib/queryClient";
import { toAppUser } from "@/lib/user";
import { useAuthStore } from "@/store/auth.store";

/*
  Resolves "who is signed in" once per page load, from the cookie session, and records the answer in
  the auth store. It does not hold the page back: the signed-out canvas at `/` is entirely local, so it
  must appear at once even while a sleeping API is still waking. The guards (ProtectedRoute, PublicRoute)
  wait for `isBootstrapped` themselves and show the wake-up splash; the navbar shows a placeholder.
 */
const AuthLoader = ({ children }: { children: ReactNode }) => {
  const { data, isSuccess, isError } = useGetProfile();
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  useEffect(() => {
    if (isSuccess && data?.data?.user) {
      setUser(toAppUser(data.data.user));
    } else if (isError || (isSuccess && !data)) {
      clearAuth();
      // No session resolved on this load — anything cached for a previous one goes with it.
      clearUserQueries();
    }
  }, [isSuccess, isError, data, setUser, clearAuth]);

  return <>{children}</>;
};

export default AuthLoader;
