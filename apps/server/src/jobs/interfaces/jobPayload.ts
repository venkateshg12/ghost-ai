export interface VerifyEmailPayload {
  userId: string;
  email: string;
  verificationToken: string;
}

export interface PasswordResetPayload {
  userId: string;
  email: string;
  resetToken: string;
}
