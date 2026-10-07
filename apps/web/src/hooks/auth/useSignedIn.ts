import queryClient from "@/lib/queryClient";
import { toAppUser } from "@/lib/user";
import { useAuthStore } from "@/store/auth.store";
import type { LoginResponse, SuccessResponse } from "@/types";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/*
  What every successful sign-in does, whichever way it happened (password, Google, verify link):
  put the user in the store and seed the profile query so AuthLoader doesn't refetch it.

  Sign-in pages sit behind PublicRoute, which moves a signed-in user on (honouring `?from=`), so they
  pass no `redirectTo`. Pages outside it — the email verify link — say where to go.
 */
export const useSignedIn = () => {
    const router = useRouter();
    const setUser = useAuthStore((state) => state.setUser);

    return useCallback((response: SuccessResponse<LoginResponse>, redirectTo?: string) => {
        setUser(toAppUser(response.data.user));
        queryClient.setQueryData(["profile"], {
            status: "success",
            data: { user: response.data.user },
        });
        if (redirectTo) router.replace(redirectTo);
    }, [router, setUser]);
};
