import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { AppError } from "./AppError";

export function hasTokenEncryptionKey(key = process.env.TOKEN_ENCRYPTION_KEY ?? ""): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(key) && Buffer.from(key, "base64").length === 32;
}

function readKey(key = process.env.TOKEN_ENCRYPTION_KEY ?? ""): Buffer {
  if (!hasTokenEncryptionKey(key)) {
    throw new AppError("Integração Meta não configurada", 503);
  }
  return Buffer.from(key, "base64");
}

export function encryptSecret(secret: string, key?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", readKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64")).join(".");
}

export function decryptSecret(value: string, key?: string): string {
  const encryptionKey = readKey(key);
  const parts = value.split(".");
  if (parts.length !== 3) throw new AppError("Credencial Meta inválida", 502);
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64"));
  if (iv.length !== 12 || tag.length !== 16) {
    throw new AppError("Credencial Meta inválida", 502);
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    throw new AppError("Credencial Meta inválida", 502);
  }
}
