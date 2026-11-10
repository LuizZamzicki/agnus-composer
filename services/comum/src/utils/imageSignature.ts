// Identifica o formato da imagem pelos primeiros bytes do arquivo (magic bytes).
// O MIME e a extensao informados pelo cliente nao sao confiaveis: basta renomear
// um arquivo para ".png" para que o navegador envie "image/png".

export const INVALID_IMAGE_MESSAGE =
  "Arquivo enviado não é uma imagem válida. Formatos aceitos: JPEG, PNG, GIF, WEBP e BMP.";

const startsWith = (buffer: Buffer, signature: number[], offset = 0) =>
  buffer.length >= offset + signature.length &&
  signature.every((byte, index) => buffer[offset + index] === byte);

const asciiAt = (buffer: Buffer, offset: number, text: string) =>
  buffer.length >= offset + text.length &&
  buffer.subarray(offset, offset + text.length).toString("ascii") === text;

export const detectImageExtension = (buffer: Buffer): string | null => {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "png";
  }

  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return "jpg";
  }

  if (asciiAt(buffer, 0, "GIF87a") || asciiAt(buffer, 0, "GIF89a")) {
    return "gif";
  }

  if (asciiAt(buffer, 0, "RIFF") && asciiAt(buffer, 8, "WEBP")) {
    return "webp";
  }

  if (asciiAt(buffer, 0, "BM") && buffer.length >= 26) {
    return "bmp";
  }

  return null;
};
