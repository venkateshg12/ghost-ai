import { Job, Worker } from "bullmq";
import { JOB_NAMES, QUEUE_NAMES } from "../../constants/queue";
import { processPasswordReset, processVerifyEmail } from "../processors/email.processor";
import { PasswordResetPayload, VerifyEmailPayload } from "../interfaces/jobPayload";
import { redisConnection } from "../redis/connection";

export const emailWorker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job: Job<any>) => {
        switch (job.name) {
            case JOB_NAMES.EMAIL.VERIFY_EMAIL:
                return await processVerifyEmail(job as Job<VerifyEmailPayload>);
            case JOB_NAMES.EMAIL.PASSWORD_RESET:
                return await processPasswordReset(job as Job<PasswordResetPayload>);
            default:
                throw new Error(`Unknown job name: ${job.name}`);
        }
    },
    {
        connection: redisConnection,
        concurrency: 5,        // Process up to 5 jobs concurrently
        lockDuration: 30000,   // 30 seconds lock duration
        limiter: {
            max: 2,         // 2 emails per second (safe for Gmail/Mailtrap)
            duration: 1000,
        }
    }
);

emailWorker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed successfully.`);
});
emailWorker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed: ${err.message}`);
});
emailWorker.on('stalled', (jobId) => {
    console.warn(`[Worker Alert] Job ${jobId} HAS STALLED! Check CPU load / Event loop freeze.`);
});
emailWorker.on('error', (err) => {
    console.error(`[Worker Connection Error] ${err.message}`);
});