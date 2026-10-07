import { z } from "zod";


// Trimmed and lowercased before validation, so lookups and stored accounts agree on one spelling
// of each address ("Foo@x.com" and "foo@x.com" are the same account).
const emailField = z.string().trim().toLowerCase().email().max(255);

/*
  Rules for a password being set (register, reset, change). bcrypt only reads the first 72 bytes, so
  anything longer would be silently truncated — rejected instead. Login deliberately doesn't apply
  these, so accounts created under the old 6-character minimum can still sign in.
 */
const newPasswordField = z
    .string()
    .min(8, { message: "Password must be at least 8 characters long" })
    .refine((value) => new TextEncoder().encode(value).length <= 72, {
        message: "Password is too long",
    });

export const credentialSchema = z.object({
    email: emailField,
    password: newPasswordField,
    userAgent: z.string().optional()
})

export const credentialsDataSchema = credentialSchema.extend({
    name: z.string().min(1).max(255)
})

export type CredentialSchema = z.infer<typeof credentialsDataSchema>;

// register inputs
const registerFieldsSchema = credentialSchema.extend({
    name: z.string().min(1).max(255),
    confirmPassword: z.string().min(1),
})

export const registerSchema = registerFieldsSchema.refine(
    (data) => data.password === data.confirmPassword, {
    message: "Password do not match",
    path: ["confirmPassword"]
}
)
export type RegisterSchema = z.infer<typeof registerSchema>;


// login inputs
export const loginInSchema = credentialSchema.extend({
    password: z.string().min(1, { message: "Password is required" }).max(255),
});
export type LoginInSchema = z.infer<typeof loginInSchema>;


// email input for forgot password
export const emailSchema = credentialSchema.pick({ email: true });
export type EmailSchema = z.infer<typeof emailSchema>


// password validation
export const resetPasswordSchema = registerFieldsSchema.pick({
    password: true,
    confirmPassword: true
}).refine(
    (data) => data.password === data.confirmPassword, {
    message: "Password do not match",
    path: ["confirmPassword"]
})


export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({
    name: z.string().trim().min(1, { message: "Name is required" }).max(255),
});
export type UpdateProfileSchema = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, { message: "Current password is required" }),
    newPassword: newPasswordField,
    confirmNewPassword: z.string().min(1),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
}).refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
});
export type ChangePasswordSchema = z.infer<typeof changePasswordSchema>;
