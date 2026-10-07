import { JOB_NAMES } from "../../constants/queue";
import { PasswordResetPayload, VerifyEmailPayload } from "../interfaces/jobPayload";
import { emailQueue } from "../queues/email.queue";

export class EmailProducer {
    static async sendVerifyEmail(payload: VerifyEmailPayload) {
        return emailQueue.add(JOB_NAMES.EMAIL.VERIFY_EMAIL, payload, {
            // Deduplicates so the same token isn't queued twice
            jobId: `verify:${payload.userId}:${payload.verificationToken}`,
        });
    }

    // Keep this alias only if existing callers use `sendVerifyMail`
    static async sendVerifyMail(payload: VerifyEmailPayload) {
        return this.sendVerifyEmail(payload);
    }

    static async sendPasswordReset(payload: PasswordResetPayload) {
        return emailQueue.add(JOB_NAMES.EMAIL.PASSWORD_RESET, payload, {
            // Deduplicates so the same reset token isn't queued twice
            jobId: `reset:${payload.userId}:${payload.resetToken}`,
        });
    }
}
