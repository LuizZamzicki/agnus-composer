import { extrairCodigoRastreio, RastreioInvalido, urlRastreio } from "../../src/utils/rastreio";

const TOKEN = "0f1e2d3c-4b5a-4697-8877-665544332211";
const LINK_LOJA = `https://app.youdraw.com.br/rastrear/${TOKEN}`;

describe("extrairCodigoRastreio", () => {
  it.each([
    ["1234", "1234"],
    ["#1234", "1234"],
    ["  A-55  ", "A-55"],
    [`${LINK_LOJA}?pedido=1234`, "1234"],
    [`app.youdraw.com.br/rastrear/${TOKEN}?id=%23987`, "987"],
  ])("aceita %s", (valor, esperado) => {
    expect(extrairCodigoRastreio(valor)).toBe(esperado);
  });

  it.each([[""], ["   "], [null], [undefined]])("trata %p como sem número", (valor) => {
    expect(extrairCodigoRastreio(valor)).toBeNull();
  });

  it.each([
    [LINK_LOJA],
    [`https://outro.youdraw.com.br/rastrear/${TOKEN}?pedido=1`],
    [`https://app.youdraw.com.br/admin?pedido=1`],
    ["número com espaço"],
    ["javascript:alert(1)"],
    [42],
  ])("recusa %p", (valor) => {
    expect(() => extrairCodigoRastreio(valor)).toThrow(RastreioInvalido);
  });
});

describe("urlRastreio", () => {
  beforeEach(() => {
    process.env.YOUDRAW_LOJA_TOKEN = TOKEN;
  });

  afterAll(() => {
    delete process.env.YOUDRAW_LOJA_TOKEN;
  });

  it("usa o número do pedido na YouDraw quando existe", () => {
    expect(urlRastreio({ status: "enviado", codigo_rastreio: "1234" }, "ana@teste.com")).toBe(`${LINK_LOJA}?pedido=1234`);
  });

  it("sem número, busca pelo e-mail do cliente", () => {
    expect(urlRastreio({ status: "pago", codigo_rastreio: null }, "ana+loja@teste.com")).toBe(`${LINK_LOJA}?pedido=ana%2Bloja%40teste.com`);
  });

  it("ignora o token da loja salvo como número de pedido e busca pelo e-mail", () => {
    expect(urlRastreio({ status: "pago", codigo_rastreio: TOKEN }, "ana@teste.com")).toBe(`${LINK_LOJA}?pedido=ana%40teste.com`);
  });

  it("não rastreia antes do pagamento, sem token ou sem como buscar", () => {
    expect(urlRastreio({ status: "aguardando_pagamento", codigo_rastreio: "1" }, "a@b.com")).toBeNull();
    expect(urlRastreio({ status: "pago", codigo_rastreio: null }, null)).toBeNull();
    delete process.env.YOUDRAW_LOJA_TOKEN;
    expect(urlRastreio({ status: "pago", codigo_rastreio: "1" }, "a@b.com")).toBeNull();
  });
});
