import { getProfileData } from "@/api/auth"
import { MAX_WAKE_RETRIES, isServerUnavailable } from "@/lib/serverStatus";
import type { ApiError, ProfileResponse, SuccessResponse } from "@/types";
import { useQuery } from "@tanstack/react-query"

export const useGetProfile = () => {
    return useQuery<SuccessResponse<ProfileResponse>, ApiError>({
        queryKey: ["profile"],
        queryFn: getProfileData,
        staleTime : 5 * 60 * 1000,
        // A 401 here just means "signed out"; retrying it would only delay the redirect. A sleeping API
        // is different: keep the query pending so the splash stays up instead of showing a signed-out page.
        retry: (failureCount, error) =>
            failureCount < MAX_WAKE_RETRIES && isServerUnavailable(error?.status),
    })
}
