import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

type ParsedBinaryImage = {
  buffer: Buffer;
  extension: string;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

const PHOTO_DIR = path.resolve(process.cwd(), "produto_fotos");
const ALLOWED_EXTENSIONS = new Set(Object.values(MIME_EXTENSION_MAP));
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const sanitizeExtension = (extension: string) => {
  return extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
};

const extensionFromMime = (mimeType: string): string | null => {
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? null;
};

const sniffImageExtension = (buffer: Buffer): string | null => {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "jpg";
  }
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a")) {
    return "gif";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return "bmp";
  }
  return null;
};

const resolveExtension = (
  explicitExt: unknown,
  explicitMime: unknown,
  fileNameExt: unknown,
): string | null => {
  if (typeof explicitMime === "string" && explicitMime.trim()) {
    return extensionFromMime(explicitMime);
  }

  const candidate =
    typeof explicitExt === "string" && explicitExt.trim()
      ? explicitExt
      : typeof fileNameExt === "string" && fileNameExt.trim()
        ? fileNameExt
        : null;

  if (!candidate) {
    return null;
  }

  const sanitized = sanitizeExtension(candidate);
  return ALLOWED_EXTENSIONS.has(sanitized) ? sanitized : null;
};

const looksLikeRawBase64 = (value: string) => {
  const normalized = value.replace(/\s+/g, "");

  return (
    normalized.length >= 64 &&
    normalized.length % 4 === 0 &&
    /^[A-Za-z0-9+/=]+$/.test(normalized)
  );
};

const parseDataUrl = (value: string): ParsedBinaryImage | null => {
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return null;
  }

  const mimeType = match[1];
  const extension = extensionFromMime(mimeType);
  if (!extension) {
    return null;
  }

  const base64Data = match[2].replace(/\s+/g, "");
  const buffer = Buffer.from(base64Data, "base64");

  if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) {
    return null;
  }

  return { buffer, extension };
};

const parseObjectImage = (source: Record<string, unknown>): ParsedBinaryImage | null => {
  const explicitExt =
    source.extensao ??
    source.ext ??
    source.extension ??
    source.tipo_extensao ??
    source.tipoExtensao;
  const explicitMime =
    source.mimeType ??
    source.mime_type ??
    source.contentType ??
    source.content_type ??
    source.mimetype ??
    source.tipo_arquivo ??
    source.tipoArquivo;
  const rawBits =
    source.bits ??
    source.base64 ??
    source.arquivo_base64 ??
    source.arquivoBase64 ??
    source.conteudo ??
    source.content ??
    source.data ??
    source.bytes ??
    source.buffer;
  const rawStringCandidate =
    typeof rawBits === "string"
      ? rawBits
      : typeof source.caminho_url === "string"
        ? source.caminho_url
        : typeof source.caminhoUrl === "string"
          ? source.caminhoUrl
          : typeof source.caminho === "string"
            ? source.caminho
            : typeof source.url === "string"
              ? source.url
              : typeof source.src === "string"
                ? source.src
                : typeof source.link === "string"
                  ? source.link
                  : typeof source.path === "string"
                    ? source.path
                    : typeof source.preview === "string"
                      ? source.preview
                      : undefined;

  const originalName =
    typeof source.originalname === "string"
      ? source.originalname
      : typeof source.nome_original === "string"
        ? source.nome_original
        : typeof source.nomeOriginal === "string"
          ? source.nomeOriginal
          : typeof source.filename === "string"
            ? source.filename
            : typeof source.fileName === "string"
              ? source.fileName
              : typeof source.nome_arquivo === "string"
                ? source.nome_arquivo
                : typeof source.nomeArquivo === "string"
                  ? source.nomeArquivo
                  : "";
  const fileNameExt = originalName.includes(".") ? originalName.split(".").pop() : "";

  if (Buffer.isBuffer(rawBits)) {
    if (!rawBits.length || rawBits.length > MAX_FILE_SIZE_BYTES) {
      return null;
    }

    const extension = resolveExtension(explicitExt, explicitMime, fileNameExt);
    if (!extension) {
      return null;
    }

    return { buffer: rawBits, extension };
  }

  if (Array.isArray(rawBits)) {
    const numericArray = rawBits.every((item) => Number.isInteger(item));
    if (!numericArray) {
      return null;
    }

    const buffer = Buffer.from(rawBits as number[]);
    if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) {
      return null;
    }

    const extension = resolveExtension(explicitExt, explicitMime, fileNameExt);
    if (!extension) {
      return null;
    }

    return { buffer, extension };
  }

  if (typeof rawStringCandidate !== "string") {
    return null;
  }

  const dataUrlParsed = parseDataUrl(rawStringCandidate.trim());
  if (dataUrlParsed) {
    return dataUrlParsed;
  }

  const normalizedBase64 = rawStringCandidate.replace(/\s+/g, "");
  if (!looksLikeRawBase64(normalizedBase64)) {
    return null;
  }

  const buffer = Buffer.from(normalizedBase64, "base64");
  if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) {
    return null;
  }

  const extension = resolveExtension(explicitExt, explicitMime, fileNameExt);
  if (!extension) {
    return null;
  }

  return { buffer, extension };
};

const parseImageBitsInput = (input: unknown): ParsedBinaryImage | null => {
  if (typeof input === "string") {
    const value = input.trim();
    if (!value) {
      return null;
    }

    const dataUrlParsed = parseDataUrl(value);
    if (dataUrlParsed) {
      return dataUrlParsed;
    }

    if (!looksLikeRawBase64(value)) {
      return null;
    }

    const buffer = Buffer.from(value.replace(/\s+/g, ""), "base64");
    if (!buffer.length || buffer.length > MAX_FILE_SIZE_BYTES) {
      return null;
    }

    const extension = sniffImageExtension(buffer);
    if (!extension) {
      return null;
    }

    return { buffer, extension };
  }

  if (input && typeof input === "object") {
    return parseObjectImage(input as Record<string, unknown>);
  }

  return null;
};

export const saveProdutoFotoBits = async (input: unknown): Promise<string | null> => {
  const parsed = parseImageBitsInput(input);
  if (!parsed) {
    return null;
  }

  const extension = sanitizeExtension(parsed.extension) || "png";
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;

  await fs.mkdir(PHOTO_DIR, { recursive: true });
  await fs.writeFile(path.join(PHOTO_DIR, fileName), parsed.buffer);

  return `produto_fotos/${fileName}`;
};
