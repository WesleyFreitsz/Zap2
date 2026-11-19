import crypto from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/3gpp": ".3gp",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "application/pdf": ".pdf",
  "application/zip": ".zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
};

function sanitizeFileName(value: string) {
  return String(value || "arquivo")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "arquivo";
}

function ensureDirectoryName(value: string) {
  return String(value || "chat-media")
    .replace(/[^a-zA-Z0-9/_-]/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "") || "chat-media";
}

function getBase64Payload(base64: string) {
  const value = String(base64 || "").trim();
  if (!value) return "";
  if (value.startsWith("data:")) {
    return value.split(",")[1] || "";
  }
  return value;
}

function getMimeType(base64: string, mimeType?: string | null) {
  if (mimeType) return mimeType;
  const value = String(base64 || "").trim();
  if (value.startsWith("data:")) {
    return value.slice(5).split(";")[0] || "application/octet-stream";
  }
  return "application/octet-stream";
}

function getFileExtension(mimeType: string, fileName?: string | null) {
  const originalExtension = path.extname(String(fileName || "").trim());
  if (originalExtension) return originalExtension;
  return MIME_EXTENSION_MAP[mimeType] || "";
}

export function isLikelyBase64Payload(value?: string | null) {
  const content = String(value || "").trim();
  if (content.length < 120) return false;
  if (content.startsWith("data:")) return true;
  if (content.startsWith("/9j/") || content.startsWith("iVBOR") || content.startsWith("R0lGOD")) {
    return true;
  }
  return /^[A-Za-z0-9+/=\s]+$/.test(content);
}

export async function saveBase64Media(options: {
  base64: string;
  directory?: string;
  fileName?: string | null;
  mimeType?: string | null;
}) {
  return saveMediaBuffer({
    buffer: Buffer.from(getBase64Payload(options.base64), "base64"),
    directory: options.directory,
    fileName: options.fileName,
    mimeType: getMimeType(options.base64, options.mimeType),
  });
}

export async function saveMediaBuffer(options: {
  buffer: Buffer;
  directory?: string;
  fileName?: string | null;
  mimeType: string;
}) {
  const { buffer, mimeType: resolvedMimeType } = options;
  const extension = getFileExtension(resolvedMimeType, options.fileName);
  const safeDirectory = ensureDirectoryName(options.directory || "chat-media");
  const safeFileName = sanitizeFileName(options.fileName || `media-${Date.now()}`);
  const fileStem = extension && safeFileName.endsWith(extension) ? safeFileName.slice(0, -extension.length) : safeFileName;
  const uniqueName = `${fileStem}-${crypto.randomUUID()}${extension}`;
  const absoluteDirectory = path.join(UPLOADS_DIR, safeDirectory);
  const absolutePath = path.join(absoluteDirectory, uniqueName);
  await mkdir(absoluteDirectory, { recursive: true });
  await writeFile(absolutePath, buffer);

  return {
    absolutePath,
    fileName: uniqueName,
    mimeType: resolvedMimeType,
    size: buffer.byteLength,
    url: `/uploads/${safeDirectory}/${uniqueName}`,
  };
}
