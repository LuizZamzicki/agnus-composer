import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { HttpError } from "@agnus/comum/types/http_error";
import { detectImageExtension } from "@agnus/comum/utils/imageSignature";

// Pasta do volume devolucao_fotos (docker-compose). Fora das pastas estáticas: quem serve é a rota
// autenticada de devolução.
export const PASTA_FOTOS = path.resolve(process.cwd(), "devolucao_fotos");
export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const MAX_FOTOS_POR_DEVOLUCAO = 3;

const TIPOS: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const ARQUIVO_VALIDO = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const tipoDoArquivo = (arquivo: string) => TIPOS[path.extname(arquivo).slice(1)] ?? "application/octet-stream";

// Aceita "data:image/...;base64,..." ou base64 puro. O tipo vem dos bytes do arquivo (assinatura),
// não do que o navegador diz: um .exe renomeado para .jpg é recusado.
export const lerFotoEnviada = (valor: unknown) => {
  if (typeof valor !== "string" || valor.length === 0) {
    throw new HttpError(400, "Envie a foto em base64.");
  }

  const conteudo = valor.replace(/^data:[^;,]+;base64,/, "").replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(conteudo)) {
    throw new HttpError(400, "Foto inválida.");
  }

  const bytes = Buffer.from(conteudo, "base64");
  if (bytes.length === 0) throw new HttpError(400, "Foto inválida.");
  if (bytes.length > MAX_FOTO_BYTES) throw new HttpError(413, "Foto muito grande (máximo de 5 MB).");

  const extensao = detectImageExtension(bytes);
  if (!extensao || !TIPOS[extensao]) {
    throw new HttpError(400, "Envie uma foto em JPG, PNG ou WEBP.");
  }

  return { bytes, extensao };
};

export const gravarFoto = async (bytes: Buffer, extensao: string) => {
  await fs.mkdir(PASTA_FOTOS, { recursive: true });
  const arquivo = `${randomUUID()}.${extensao}`;
  await fs.writeFile(path.join(PASTA_FOTOS, arquivo), bytes, { flag: "wx" });
  return arquivo;
};

// O nome vem do banco, mas confere mesmo assim: nunca sai da pasta (sem "../").
export const caminhoDaFoto = (arquivo: string) => {
  if (!ARQUIVO_VALIDO.test(arquivo)) {
    throw new HttpError(404, "Foto não encontrada.");
  }
  return path.join(PASTA_FOTOS, arquivo);
};

export const apagarFoto = async (arquivo: string) => {
  try {
    await fs.unlink(caminhoDaFoto(arquivo));
  } catch {
    // Já não existia: nada a fazer.
  }
};
