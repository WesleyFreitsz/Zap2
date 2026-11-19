import dotenv from "dotenv";
dotenv.config();

function requireSecret(name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string {
  const secret = process.env[name];
  if (!secret?.trim()) throw new Error(`${name} is required`);
  return secret;
}

const frontendOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",

  DATABASE_URL: process.env.DATABASE_URL!,

  JWT_SECRET: requireSecret("JWT_SECRET"),
  JWT_REFRESH_SECRET: requireSecret("JWT_REFRESH_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  // SMTP (Nodemailer)
  SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com",
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "Zap2 <noreply@example.com>",

  // Frontend
  FRONTEND_URL: frontendOrigins[0] ?? "",
  FRONTEND_ORIGINS: frontendOrigins,

  // Asaas
  ASAAS_API_URL:
    process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3",
  ASAAS_API_KEY: process.env.ASAAS_API_KEY || "",
  ASAAS_WEBHOOK_TOKEN: process.env.ASAAS_WEBHOOK_TOKEN || "",

  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  GROQ_MODEL: process.env.GROQ_MODEL || "openai/gpt-oss-120b",

  META_APP_ID: process.env.META_APP_ID || "",
  META_APP_SECRET: process.env.META_APP_SECRET || "",
  META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN || "",
  META_GRAPH_VERSION: process.env.META_GRAPH_VERSION || "v27.0",
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY || "",
  META_ALLOW_MANUAL_CONNECT:
    (process.env.NODE_ENV || "development") === "development" &&
    process.env.META_ALLOW_MANUAL_CONNECT === "true",
};
