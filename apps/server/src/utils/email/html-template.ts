import { CORS_ORIGIN } from "../../constants/env";

export const passwordResetTemplate = (resetLink: string) => (
    `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Password Reset</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
    <td align="center" style="padding:40px 20px;">
                        
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
    
    <!-- Header -->
    <tr>
    <td style="background:#111827;padding:30px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;">
    👻 Ghost AI
    </h1>
    </td>
    </tr>
    
    <!-- Content -->
    <tr>
    <td style="padding:40px;">
    
    <h2 style="margin-top:0;color:#111827;">
    Reset Your Password
    </h2>
    
    <p style="color:#4b5563;font-size:16px;line-height:1.6;">
    We received a request to reset your password.
    Click the button below to choose a new password.
    </p>
    
    <div style="text-align:center;margin:35px 0;">
    <a
    href="${resetLink}"
    style="
    background:#00a3ad;
    color:#ffffff;
    text-decoration:none;
    padding:14px 28px;
    border-radius:8px;
    display:inline-block;
    font-weight:bold;
    "
    >
    Reset Password
    </a>
    </div>
    
    <p style="color:#6b7280;font-size:14px;">
    This link will expire in 10 minutes.
    </p>
    
    <p style="color:#6b7280;font-size:14px;">
    If you did not request a password reset,
    you can safely ignore this email.
    </p>
    
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;" />
    
    <p style="font-size:13px;color:#9ca3af;word-break:break-all;">
    If the button doesn't work, copy and paste this link into your browser:
    <br /><br />
    ${resetLink}
    </p>
    
    </td>
    </tr>
    
    <!-- Footer -->
    <tr>
    <td style="background:#f9fafb;padding:20px;text-align:center;">
    <p style="margin:0;color:#6b7280;font-size:13px;">
    © ${new Date().getFullYear()} Ghost AI.
    All rights reserved.
    </p>
    </td>
    </tr>
    
    </table>
    
    </td>
    </tr>
    </table>
    
    </body>
    </html>
    `
);

export const emailVerificationTemplate = (verificationLink: string) => (
    `<!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    
    <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
    
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
    <td align="center" style="padding:40px 20px;">
    
    <table width="600" cellpadding="0" cellspacing="0"
    style="
    background:#ffffff;
    border-radius:12px;
    overflow:hidden;
    box-shadow:0 2px 10px rgba(0,0,0,0.08);
    ">
    
    <!-- Header -->
    <tr>
    <td style="background:#111827;padding:30px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;">
    👻 Ghost AI
    </h1>
    </td>
    </tr>
    
    <!-- Content -->
    <tr>
    <td style="padding:40px;">
    
    <h2 style="margin-top:0;color:#111827;">
    Verify Your Email Address
    </h2>
    
    <p style="color:#4b5563;font-size:16px;line-height:1.6;">
    Thank you for creating your account.
    Please verify your email address to activate your account and start designing systems with your team.
    </p>
    
    <div style="text-align:center;margin:35px 0;">
    <a
    href="${verificationLink}"
    style="
    background:#00a3ad;
    color:#ffffff;
    text-decoration:none;
    padding:14px 28px;
    border-radius:8px;
    display:inline-block;
    font-weight:bold;
    "
    >
    Verify Email
    </a>
    </div>
    
    <p style="color:#6b7280;font-size:14px;">
    This verification link will expire in 10 minutes.
    </p>
    
    <p style="color:#6b7280;font-size:14px;">
    If you didn't create this account, you can safely ignore this email.
    </p>
    
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:30px 0;" />
    
    <p style="font-size:13px;color:#9ca3af;word-break:break-all;">
    If the button doesn't work, copy and paste the following link into your browser:
    <br /><br />
    ${verificationLink}
    </p>
    
    </td>
    </tr>

    <!-- Footer -->
    <tr>
    <td style="background:#f9fafb;padding:20px;text-align:center;">
    <p style="margin:0;color:#6b7280;font-size:13px;">
    © ${new Date().getFullYear()} Ghost AI.
    All rights reserved.
    </p>
</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`
);
