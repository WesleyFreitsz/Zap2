import { createHash, randomBytes } from "node:crypto";

export function generateSecretToken(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString("base64url")}`;
}

export function hashSecretToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readBearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}
