import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import { HttpError } from "../types/http_error";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const fileFilter = (_req: Request, file: Express.Multer.File, callback: FileFilterCallback) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
    return callback(new HttpError(400, "Tipo de arquivo nao permitido. Envie apenas imagens (JPEG, PNG, GIF, WEBP, BMP)."));
  }

  return callback(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 50,
  },
  fileFilter,
});

export const uploadAny = upload.any();
