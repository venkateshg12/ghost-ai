import { register } from "@/api/auth"
import type { ApiError, RegisterResponse, SuccessResponse } from "@/types";
import type { RegisterSchema } from "@repo/types"
import { useMutation } from "@tanstack/react-query"

export const useRegister = () => {
    return useMutation<
    SuccessResponse<RegisterResponse>, // onSuccess receives this
    ApiError,                          // onError receives this
    RegisterSchema                     // mutate() accepts this
    >({
        mutationFn : register
    })
}
