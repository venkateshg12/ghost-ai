"use client";

import { useEffect, type ReactNode } from "react";
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

  if (!isBootstrapped) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base p-6 text-center select-none">
        <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-surface-border animate-pulse" />
          <div className="absolute inset-0 rounded-full border-t border-brand animate-spin" />
          <div className="h-1.5 w-1.5 rounded-full bg-brand" />
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-copy-faint">Ghost AI</p>
        <p className="mt-2 text-sm text-copy-muted">Preparing your workspace…</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthLoader;
