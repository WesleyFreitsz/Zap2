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
  return transporter.sendMail({ from: env.SMTP_FROM, to, subject, html });
}

export default transporter;
