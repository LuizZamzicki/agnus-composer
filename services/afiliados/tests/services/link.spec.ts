import { normalizarDestino, normalizarSubIds } from "../../src/services/link.service";

jest.mock("../../src/models", () => ({}));

beforeAll(() => {
  process.env.FRONTEND_URL = "https://agnusfit.com";
});

describe("normalizarDestino", () => {
  it.each([
    ["/produto/12", "/produto/12"],
    ["https://agnusfit.com/produto/12?cor=preto", "/produto/12?cor=preto"],
    ["produto/12", "/produto/12"],
    ["https://agnusfit.com/catalogo", "/catalogo"],
  ])("aceita %s", (url, esperado) => {
    expect(normalizarDestino(url)).toBe(esperado);
  });

  it.each([
    ["https://site-falso.com/produto/1"],
    ["//site-falso.com/produto/1"],
    ["javascript:alert(1)"],
    ["https://agnusfit.com/l/abc"],
    ["https://agnusfit.com/api/orders"],
    [""],
    [123],
  ])("recusa %p (não vira redirecionador aberto)", (url) => {
    expect(() => normalizarDestino(url)).toThrow();
  });
});

describe("normalizarSubIds", () => {
  it("aceita até 5 sub_ids simples", () => {
    expect(normalizarSubIds(["instagram", "story_1"])).toEqual(["instagram", "story_1"]);
    expect(normalizarSubIds(undefined)).toEqual([]);
  });

  it("recusa mais de 5 ou com caracteres inválidos", () => {
    expect(() => normalizarSubIds(["a", "b", "c", "d", "e", "f"])).toThrow();
    expect(() => normalizarSubIds(["com espaço"])).toThrow();
    expect(() => normalizarSubIds("instagram")).toThrow();
  });
});
