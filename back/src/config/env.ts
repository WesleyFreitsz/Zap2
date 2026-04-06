import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",

  DATABASE_URL: process.env.DATABASE_URL!,

  JWT_SECRET: process.env.JWT_SECRET || "default-secret",
  JWT_REFRESH_SECRET:
    process.env.JWT_REFRESH_SECRET || "default-refresh-secret",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || "http://localhost:8080",
  EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || "",
  EVOLUTION_WEBHOOK_BASE_URL:
    process.env.EVOLUTION_WEBHOOK_BASE_URL ||
    "http://localhost:3000/api/webhook",

  // SMTP (Nodemailer)
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "ZapAI <noreply@zapai.com>",

  // Frontend
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",

  // Asaas
  ASAAS_API_URL:
    process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3",
  ASAAS_API_KEY: process.env.ASAAS_API_KEY || "",
  ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN || "",
};
