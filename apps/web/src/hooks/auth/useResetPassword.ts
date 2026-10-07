import { resetPassword } from "@/api/auth"
import type { ApiError, SuccessResponse } from "@/types";
import type { ResetPasswordSchema } from "@repo/types";
import { useMutation } from "@tanstack/react-query"

export const useResetPassword = () => {
    return useMutation<
    SuccessResponse<string>,
    ApiError,
    ResetPasswordSchema & { token: string }
    >({
        mutationFn: resetPassword
    });
}
