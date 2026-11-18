import { caminhoDaFoto, lerFotoEnviada, MAX_FOTO_BYTES, tipoDoArquivo } from "../../src/utils/devolucaoFotoStorage";

// Bytes mínimos com a assinatura de cada formato (o resto do arquivo não importa para a checagem).
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const PDF = Buffer.from("%PDF-1.7 qualquer coisa");

describe("lerFotoEnviada", () => {
  it("aceita data URL e base64 puro, e o tipo vem dos bytes", () => {
    expect(lerFotoEnviada(`data:image/png;base64,${PNG.toString("base64")}`).extensao).toBe("png");
    expect(lerFotoEnviada(JPG.toString("base64")).extensao).toBe("jpg");
  });

  it("recusa arquivo que não é imagem mesmo dizendo que é (ex.: PDF como image/jpeg)", () => {
    expect(() => lerFotoEnviada(`data:image/jpeg;base64,${PDF.toString("base64")}`)).toThrow(/JPG, PNG ou WEBP/);
  });

  it("recusa vazio, texto que não é base64 e arquivo grande demais", () => {
    expect(() => lerFotoEnviada("")).toThrow();
    expect(() => lerFotoEnviada(42)).toThrow();
    expect(() => lerFotoEnviada("não é base64 !!!")).toThrow(/inválida/);
    const grande = Buffer.concat([PNG, Buffer.alloc(MAX_FOTO_BYTES)]);
    expect(() => lerFotoEnviada(grande.toString("base64"))).toThrow(/5 MB/);
  });
});

describe("caminhoDaFoto", () => {
  it("só aceita nomes gerados pelo sistema (sem sair da pasta)", () => {
    expect(caminhoDaFoto("0a1b2c3d-1111-2222-3333-444455556666.jpg")).toMatch(/devolucao_fotos[\\/]0a1b2c3d-1111-2222-3333-444455556666\.jpg$/);
    expect(() => caminhoDaFoto("../../etc/passwd")).toThrow();
    expect(() => caminhoDaFoto("foto.exe")).toThrow();
  });

  it("devolve o tipo certo para servir o arquivo", () => {
    expect(tipoDoArquivo("x.jpg")).toBe("image/jpeg");
    expect(tipoDoArquivo("x.webp")).toBe("image/webp");
  });
});
