export const QUEUE_NAMES = {
    EMAIL : 'ghost-ai-email-queue'
} as const;

export const JOB_NAMES = {
    EMAIL : {
        VERIFY_EMAIL : 'send_verify_email',
        PASSWORD_RESET : 'send_password_reset'
    }
}as const;
