import { normalizarTabelaMedidas } from "../../src/utils/tabelaMedidas";

const valida = () => ({
  modelo: "camiseta",
  colunas: [
    { chave: "largura", rotulo: "Largura", descricao: "De uma axila à outra" },
    { chave: "comprimento", rotulo: "Comprimento", descricao: "" },
  ],
  linhas: [
    { tamanho: "P", valores: { largura: 50, comprimento: "70,5" } },
    { tamanho: "M", valores: { largura: "53", comprimento: 72 } },
  ],
  observacao: "  Pode variar 2 cm.  ",
});

describe("normalizarTabelaMedidas", () => {
  it("aceita a tabela, converte vírgula e texto para número e limpa espaços", () => {
    expect(normalizarTabelaMedidas(valida())).toEqual({
      modelo: "camiseta",
      colunas: [
        { chave: "largura", rotulo: "Largura", descricao: "De uma axila à outra" },
        { chave: "comprimento", rotulo: "Comprimento", descricao: "" },
      ],
      linhas: [
        { tamanho: "P", valores: { largura: 50, comprimento: 70.5 } },
        { tamanho: "M", valores: { largura: 53, comprimento: 72 } },
      ],
      observacao: "Pode variar 2 cm.",
    });
  });

  it("aceita JSON em texto (vindo de formulário)", () => {
    expect(normalizarTabelaMedidas(JSON.stringify(valida()))?.linhas).toHaveLength(2);
  });

  it.each([[null], [undefined], [""], [{}]])("%p remove a tabela", (valor) => {
    expect(normalizarTabelaMedidas(valor)).toBeNull();
  });

  it.each([
    ["modelo desconhecido", { ...valida(), modelo: "vestido" }, /modelo/],
    ["medida vazia", { ...valida(), linhas: [{ tamanho: "P", valores: { largura: 50 } }] }, /Comprimento.*tamanho P/],
    ["medida zero ou absurda", { ...valida(), linhas: [{ tamanho: "P", valores: { largura: 0, comprimento: 999 } }] }, /Largura/],
    ["tamanho repetido", { ...valida(), linhas: [valida().linhas[0], { ...valida().linhas[1], tamanho: "p" }] }, /repetidos/],
    ["coluna repetida", { ...valida(), colunas: [valida().colunas[0], valida().colunas[0]] }, /repetidas/],
    ["chave com espaço", { ...valida(), colunas: [{ chave: "largura peito", rotulo: "Largura" }] }, /chave/],
    ["sem linhas", { ...valida(), linhas: [] }, /tamanhos/],
    ["JSON quebrado", "{nao é json", /JSON/],
  ])("recusa %s", (_nome, valor, mensagem) => {
    expect(() => normalizarTabelaMedidas(valor)).toThrow(mensagem);
  });
});
