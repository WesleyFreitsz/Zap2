import nodemailer from "nodemailer";
import { env } from "./env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendMail(to: string, subject: string, html: string) {
  console.log("🔍 [MAIL] Attempting to send email:", {
    to,
    subject,
    from: env.SMTP_FROM,
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    hasPassword: !!env.SMTP_PASS,
  });

  try {
    const result = await transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
    console.log("✅ [MAIL] Email sent successfully:", {
      messageId: result.messageId,
      response: result.response,
      accepted: result.accepted,
      rejected: result.rejected,
    });
    return result;
  } catch (error) {
    console.error("❌ [MAIL] Failed to send email:", {
      error: (error as Error).message,
      to,
      subject,
      smtpConfig: {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
      }
    });
    throw error;
  }
}

export default transporter;
