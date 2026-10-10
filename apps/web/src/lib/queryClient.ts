import { QueryClient } from "@tanstack/react-query";
import {
  MAX_WAKE_RETRIES,
  isServerUnavailable,
  wakeRetryDelay,
} from "@/lib/serverStatus";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only "the server isn't up yet" is worth retrying; a 4xx would just fail again. While a query
      // retries it stays pending, so the page keeps its loading state instead of flipping to "signed out"
      // or an error: a sleeping free-tier API takes up to a minute to wake.
      retry: (failureCount, error) =>
        failureCount < MAX_WAKE_RETRIES &&
        isServerUnavailable((error as { status?: unknown } | null)?.status),
      retryDelay: wakeRetryDelay,
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
const USER_SCOPED_KEYS = [
  "projects",
  "project",
  "members",
  "canvas",
  "specs",
  "spec",
  "sessions",
  "ai-usage",
];

// Called wherever the session ends — logout, a failed refresh, a session that no longer resolves.
export const clearUserQueries = () => {
  for (const key of USER_SCOPED_KEYS) {
    queryClient.removeQueries({ queryKey: [key] });
  }
};
