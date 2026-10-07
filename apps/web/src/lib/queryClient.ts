import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Only "the server didn't answer" is worth retrying; a 4xx would just fail again.
            retry: (failureCount, error) =>
                failureCount < 2 && (error as { status?: unknown } | null)?.status === 0,
            refetchOnWindowFocus: false,
        },
    },
});

export default queryClient;

/**
 * Query keys holding data that belongs to the signed-in user. On logout the queries themselves go
 * quiet — they are gated on `user` — but their cached data stays, so it is dropped explicitly.
 *
 * `profile` is deliberately absent: AuthLoader keeps an observer on it for the whole session, so
 * removing it would send the query straight back out. Logout overwrites it with null instead.
 */
const USER_SCOPED_KEYS = ["projects", "project", "members", "canvas", "specs", "spec", "sessions"];

// Called wherever the session ends — logout, a failed refresh, a session that no longer resolves.
export const clearUserQueries = () => {
    for (const key of USER_SCOPED_KEYS) {
        queryClient.removeQueries({ queryKey: [key] });
    }
};
