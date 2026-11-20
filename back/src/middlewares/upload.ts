import type { NextFunction, Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import path from "path";
import { AppError } from "../utils/AppError";

const uploadDir = path.join(__dirname, "../../uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (
  _req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "Only image files are allowed (jpg, png, gif, webp, svg)",
        400,
      ) as any,
    );
  }
};

export const uploadLogo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single("logo");

export const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single("imageFile");

const CHAT_MEDIA_MAX_BYTES = 16 * 1024 * 1024;
const CHAT_MEDIA_MIMES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const chatMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_MEDIA_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mimeType = file.mimetype.split(";")[0].trim().toLowerCase();
    if (/^(image|video|audio)\//.test(mimeType) || CHAT_MEDIA_MIMES.has(mimeType)) {
      cb(null, true);
      return;
    }
    cb(new AppError("Tipo de arquivo não permitido", 415));
  },
}).single("file");

export function uploadChatMedia(req: Request, res: Response, next: NextFunction): void {
  chatMediaUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        error.code === "LIMIT_FILE_SIZE"
          ? new AppError("Arquivo maior que 16MB", 413)
          : new AppError("Upload inválido", 400),
      );
      return;
    }
    if (error) {
      next(error);
      return;
    }
    if (!req.file) {
      next(new AppError("Arquivo obrigatório", 400));
      return;
    }
    next();
  });
}
