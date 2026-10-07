import { verifyEmail } from "@/api/auth";
import type { ApiError, LoginResponse, SuccessResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useSignedIn } from "./useSignedIn";

// A verify link signs the user in, so a short pause shows the success state before the redirect.
const REDIRECT_DELAY_MS = 1500;

export const useVerifyEmail = () => {
    const onSignedIn = useSignedIn();

    return useMutation<SuccessResponse<LoginResponse>, ApiError, string>({
        mutationFn: verifyEmail,
        onSuccess: (response) => {
            setTimeout(() => onSignedIn(response, "/editor"), REDIRECT_DELAY_MS);
        },
    });
};
