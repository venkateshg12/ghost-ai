import API from "@/lib/api";
import type { LoginResponse, MessageResponse, ProfileResponse, RegisterResponse, SuccessResponse } from "@/types";
import type { ChangePasswordSchema, LoginInSchema, RegisterSchema, ResetPasswordSchema, UpdateProfileSchema } from "@repo/types";

export const register = async (data: RegisterSchema): Promise<SuccessResponse<RegisterResponse>> => {
    const response = await API.post<SuccessResponse<RegisterResponse>>("/auth/register", data);
    return response.data;
}

export const login = async (data: LoginInSchema): Promise<SuccessResponse<LoginResponse>> => {
    const response = await API.post<SuccessResponse<LoginResponse>>("/auth/login", data);
    return response.data;
}

export const logout = async (): Promise<SuccessResponse<MessageResponse>> => {
    const response = await API.get<SuccessResponse<MessageResponse>>("/auth/logout");
    return response.data;
}

export const verifyEmail = async (token: string): Promise<SuccessResponse<LoginResponse>> => {
    const response = await API.get<SuccessResponse<LoginResponse>>(`/auth/verify/${token}`);
    return response.data;
}

export const resendVerificationEmail = async (email: string): Promise<SuccessResponse<MessageResponse>> => {
    const response = await API.post<SuccessResponse<MessageResponse>>("/auth/verify/resend", { email });
    return response.data;
}

export const forgotPassword = async (email: string): Promise<SuccessResponse<MessageResponse>> => {
    const response = await API.post<SuccessResponse<MessageResponse>>("/auth/password/forgot", { email });
    return response.data;
}

export const resetPassword = async (data: ResetPasswordSchema & { token: string }): Promise<SuccessResponse<string>> => {
    const { token, password, confirmPassword } = data;
    const response = await API.post<SuccessResponse<string>>(`/auth/password/reset/${token}`, { password, confirmPassword });
    return response.data;
}

export const googleLogin = async (idToken: string): Promise<SuccessResponse<LoginResponse>> => {
    const response = await API.post<SuccessResponse<LoginResponse>>("/auth/google", { idToken });
    return response.data;
}

export const getProfileData = async (): Promise<SuccessResponse<ProfileResponse>> => {
    const response = await API.get<SuccessResponse<ProfileResponse>>("/auth/me");
    return response.data;
}

export const updateProfile = async (data: UpdateProfileSchema): Promise<SuccessResponse<ProfileResponse>> => {
    const response = await API.patch<SuccessResponse<ProfileResponse>>("/auth/me", data);
    return response.data;
}

export const changePassword = async (data: ChangePasswordSchema): Promise<SuccessResponse<MessageResponse>> => {
    const response = await API.post<SuccessResponse<MessageResponse>>("/auth/me/password", data);
    return response.data;
}
