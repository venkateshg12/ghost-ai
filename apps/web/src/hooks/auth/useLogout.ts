import { logout } from "@/api/auth";
import queryClient, { clearUserQueries } from "@/lib/queryClient";
import { useAuthStore } from "@/store/auth.store";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const useLogout = () => {
    const router = useRouter();
    const clearAuth = useAuthStore((state) => state.clearAuth);

    return useMutation({
        mutationFn: logout,
        // Sign out locally even if the request fails — the user asked to leave.
        onSettled: () => {
            queryClient.setQueryData(["profile"], null);
            clearAuth();
            // After clearAuth, so the user-scoped queries are already gated off and cannot refetch.
            clearUserQueries();
            router.replace("/sign-in");
        },
    });
};
