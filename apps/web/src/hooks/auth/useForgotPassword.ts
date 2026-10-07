import { forgotPassword } from "@/api/auth"
import type { ApiError, MessageResponse, SuccessResponse } from "@/types";
import { useMutation } from "@tanstack/react-query"

export const useForgotPassword = () => {
    return useMutation<
    SuccessResponse<MessageResponse>,
    ApiError,
    string
    >({
        mutationFn: forgotPassword
    });
}
