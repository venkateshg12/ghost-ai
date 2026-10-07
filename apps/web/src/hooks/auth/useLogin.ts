import { login } from "@/api/auth";
import type { ApiError, LoginResponse, SuccessResponse } from "@/types";
import type { LoginInSchema } from "@repo/types";
import { useMutation } from "@tanstack/react-query";
import { useSignedIn } from "./useSignedIn";

export const useLogin = () => {
    const onSignedIn = useSignedIn();

    return useMutation<
    SuccessResponse<LoginResponse>,
    ApiError,
    LoginInSchema
    >({
        mutationFn: login,
        onSuccess: (response) => onSignedIn(response),
    });
};
