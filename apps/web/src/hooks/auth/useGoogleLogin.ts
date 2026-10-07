import { googleLogin } from "@/api/auth";
import type { ApiError, LoginResponse, SuccessResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";
import { useSignedIn } from "./useSignedIn";

export const useGoogleLogin = () => {
    const onSignedIn = useSignedIn();

    return useMutation<
    SuccessResponse<LoginResponse>,
    ApiError,
    string
    >({
        mutationFn: googleLogin,
        onSuccess: (response) => onSignedIn(response),
    });
};
