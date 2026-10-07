import { getProfileData } from "@/api/auth"
import type { ApiError, ProfileResponse, SuccessResponse } from "@/types";
import { useQuery } from "@tanstack/react-query"

export const useGetProfile = () => {
    return useQuery<SuccessResponse<ProfileResponse>, ApiError>({
        queryKey: ["profile"],
        queryFn: getProfileData,
        staleTime : 5 * 60 * 1000,
        // A 401 here just means "signed out"; retrying it would only delay the redirect.
        retry: false,
    })
}
