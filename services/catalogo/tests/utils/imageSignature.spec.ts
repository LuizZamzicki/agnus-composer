jest.mock("fs", () => ({
  __esModule: true,
  promises: { mkdir: jest.fn(), writeFile: jest.fn() },
}));

import { promises as fs } from "fs";
import { detectImageExtension } from "@agnus/comum/utils/imageSignature";
import { saveProdutoFotoBits } from "../../src/utils/produtoFotoStorage";
import { JPEG_BYTES, PNG_BYTES } from "../helpers/images";

const GIF_BYTES = Buffer.from("GIF89a\x01\x00\x01\x00", "binary");
const WEBP_BYTES = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const BMP_BYTES = Buffer.concat([Buffer.from("BM"), Buffer.alloc(30)]);
const HTML_BYTES = Buffer.from("<html><script>alert(1)</script></html>");
const EXE_BYTES = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
const PDF_BYTES = Buffer.from("%PDF-1.7\n");

describe("detectImageExtension", () => {
  it.each([
    ["png", PNG_BYTES],
    ["jpg", JPEG_BYTES],
    ["gif", GIF_BYTES],
    ["webp", WEBP_BYTES],
    ["bmp", BMP_BYTES],
  ])("reconhece %s pelo conteudo", (extension, buffer) => {
    expect(detectImageExtension(buffer)).toBe(extension);
  });

  it.each([
    ["HTML", HTML_BYTES],
    ["executavel", EXE_BYTES],
    ["PDF", PDF_BYTES],
    ["vazio", Buffer.alloc(0)],
    ["PNG truncado", PNG_BYTES.subarray(0, 4)],
    ["BM curto", Buffer.from("BM")],
  ])("recusa %s", (_label, buffer) => {
    expect(detectImageExtension(buffer)).toBeNull();
  });
});

describe("saveProdutoFotoBits válida o conteudo", () => {
  const writeFile = fs.writeFile as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it("recusa arquivo Multer renomeado para .png", async () => {
    const file = { fieldname: "foto", buffer: HTML_BYTES, mimetype: "image/png", originalname: "foto.png" };

    await expect(saveProdutoFotoBits(file)).resolves.toBeNull();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("recusa data URL que declara imagem mas contem outro conteudo", async () => {
    await expect(saveProdutoFotoBits(`data:image/jpeg;base64,${EXE_BYTES.toString("base64")}`)).resolves.toBeNull();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("grava imagem real com a extensao do conteudo, não a declarada", async () => {
    const file = { fieldname: "foto", buffer: PNG_BYTES, mimetype: "image/jpeg", originalname: "foto.jpg" };

    await expect(saveProdutoFotoBits(file)).resolves.toMatch(/^produto_fotos\/\d+-[\w-]+\.png$/);
    expect(writeFile).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), PNG_BYTES);
  });
});
