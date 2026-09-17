import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { HttpError } from "../types/http_error";

const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: "Arquivo muito grande. Tamanho maximo permitido: 20MB.",
  LIMIT_FILE_COUNT: "Muitos arquivos enviados.",
  LIMIT_UNEXPECTED_FILE: "Campo de arquivo inesperado.",
};

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }

  if (error instanceof MulterError) {
    return res.status(400).json({
      message: MULTER_ERROR_MESSAGES[error.code] ?? `Erro no upload: ${error.message}`,
    });
  }

  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ message: "Este registro ja existe no sistema." });
  }

  if (error.name === "SequelizeForeignKeyConstraintError") {
    return res.status(400).json({
      message: "Operacao invalida: referencia um dado que nao existe ou esta em uso.",
    });
  }

  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({ message: "Os dados enviados sao invalidos." });
  }

  return res.status(500).json({ message: "Erro interno do servidor. Tente novamente mais tarde." });
};
