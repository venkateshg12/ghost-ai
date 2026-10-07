import { Resend } from "resend";
import { RESEND_API_KEY, EMAIL_FROM } from "../../constants/env";

export interface MailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}

const resend = new Resend(RESEND_API_KEY);

export const sendMail = async (options: MailOptions) => {
    // If no RESEND_API_KEY is provided, fallback to console logging (helpful for local testing)
    if (!RESEND_API_KEY) {
        console.log("--- DEVELOPMENT MAIL SEND ---");
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body: ${options.text}`);
        console.log("------------------------------");
        return {
            data: null,
            error: null,
        };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: EMAIL_FROM || "onboarding@resend.dev",
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        });

        if (error) {
            console.error("[Resend] Email sending failed:", error);
            return {
                data: null,
                error
            };
        }

        return {
            data,
            error: null
        };
    } catch (error) {
        console.error("[Resend] Unexpected error while sending email:", error);
        return {
            data: null,
            error
        };
    }
};
