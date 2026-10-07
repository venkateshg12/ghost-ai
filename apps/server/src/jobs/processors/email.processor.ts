import { Job, UnrecoverableError } from "bullmq";
import { z } from "zod";
import { PasswordResetPayload, VerifyEmailPayload } from "../interfaces/jobPayload";
import { getPasswordResetEmail, getVerificationEmail, sendMail } from "../../utils/email";
import { orm } from "../../prisma/db";

const verifyEmailPayloadSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    email: z.string().email("Invalid email format"),
    verificationToken: z.string().min(1, "Verification token is required"),
});

const passwordResetPayloadSchema = z.object({
    userId: z.string().min(1, "User ID is required"),
    email: z.string().email("Invalid email format"),
    resetToken: z.string().min(1, "Reset token is required"),
});

export async function processVerifyEmail(job: Job<VerifyEmailPayload>) {
    const parsed = verifyEmailPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
        throw new UnrecoverableError(`Malformed job payload: ${parsed.error.message}`);
    }
    const { userId, email, verificationToken } = parsed.data;

    job.log(`[Start] Sending Verification Email to ${email} (User ID: ${userId})`);

    // Check if user exists and if already verified (Idempotency check)
    const user = await orm.User.where({ id: userId }).select("id", "verified").first();
    if (!user) {
        job.log(`[VerifyEmail] User ${userId} no longer exists. Aborting.`);
        return { status: 'skipped', reason: 'User not found' };
    }

    if (user.verified) {
        job.log(`[VerifyEmail] User ${userId} is already verified. Skipping email delivery.`);
        return { status: 'skipped', reason: 'User already verified' };
    }

    const emailTemplate = getVerificationEmail(verificationToken);

    job.log(`[SMTP] Delivering verification email to ${email}`);
    const { data, error } = await sendMail({
        to: email,
        ...emailTemplate,
    });

    if (error) {
        job.log(`[Error] Failed to send email to ${email}: ${error}`);
        throw new Error(`Failed to send email to ${email}: ${error}`);
    }

    job.log(`[Success] Verification email delivered to ${email}`);
    return { status: 'sent', deliveredAt: new Date().toISOString(), info: data };
}

export async function processPasswordReset(job: Job<PasswordResetPayload>) {
    const parsed = passwordResetPayloadSchema.safeParse(job.data);
    if (!parsed.success) {
        throw new UnrecoverableError(`Malformed job payload: ${parsed.error.message}`);
    }
    const { userId, email, resetToken } = parsed.data;

    job.log(`[Start] Sending Password Reset Email to ${email} (User ID: ${userId})`);

    // Check if user exists
    const user = await orm.User.where({ id: userId }).select("id", "verified").first();
    if (!user) {
        job.log(`[PasswordReset] User ${userId} no longer exists. Aborting.`);
        return { status: 'skipped', reason: 'User not found' };
    }

    const emailTemplate = getPasswordResetEmail(resetToken);

    job.log(`[SMTP] Delivering password reset email to ${email}`);
    const { data, error } = await sendMail({
        to: email,
        ...emailTemplate,
    });

    if (error) {
        job.log(`[Error] Failed to send password reset email to ${email}: ${error}`);
        throw new Error(`Failed to send password reset email to ${email}: ${error}`);
    }

    job.log(`[Success] Password reset email delivered to ${email}`);
    return { status: 'sent', deliveredAt: new Date().toISOString(), info: data };
}