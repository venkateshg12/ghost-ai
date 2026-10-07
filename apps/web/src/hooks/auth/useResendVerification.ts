import { resendVerificationEmail } from "@/api/auth";
import type { ApiError, MessageResponse, SuccessResponse } from "@/types";
import { useMutation } from "@tanstack/react-query";

export const useResendVerification = () => {
    return useMutation<SuccessResponse<MessageResponse>, ApiError, string>({
        mutationFn: resendVerificationEmail,
    });
};
