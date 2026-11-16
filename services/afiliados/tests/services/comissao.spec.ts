import { calcularComissao, statusPelaSituacaoDoPedido, taxaDoItem, type Regras } from "../../src/services/comissao.service";

jest.mock("../../src/models", () => ({ RegrasComissao: { findAll: jest.fn() } }));

const regras = (parcial: Partial<Regras> = {}): Regras => ({
  padrao: 10,
  porCategoria: new Map([[5, 12]]),
  porProduto: new Map([[1, 20]]),
  ...parcial,
});

describe("taxaDoItem (prioridade)", () => {
  it("produto > categoria > afiliado > padrão", () => {
    const afiliado = { taxa_personalizada: "15.00" };
    expect(taxaDoItem({ id_produto: 1, id_categoria: 5 }, regras(), afiliado)).toEqual({ taxa: 20, origem_taxa: "produto" });
    expect(taxaDoItem({ id_produto: 2, id_categoria: 5 }, regras(), afiliado)).toEqual({ taxa: 12, origem_taxa: "categoria" });
    expect(taxaDoItem({ id_produto: 2, id_categoria: 9 }, regras(), afiliado)).toEqual({ taxa: 15, origem_taxa: "afiliado" });
    expect(taxaDoItem({ id_produto: 2, id_categoria: null }, regras(), null)).toEqual({ taxa: 10, origem_taxa: "padrao" });
  });

  it("sem regra padrão cadastrada, usa AFILIADOS_TAXA_PADRAO", () => {
    process.env.AFILIADOS_TAXA_PADRAO = "8";
    expect(taxaDoItem({ id_produto: 2, id_categoria: null }, regras({ padrao: null }))).toEqual({ taxa: 8, origem_taxa: "padrao" });
    delete process.env.AFILIADOS_TAXA_PADRAO;
  });

  it("taxa 0 no produto vale (produto sem comissão)", () => {
    expect(taxaDoItem({ id_produto: 3, id_categoria: 5 }, regras({ porProduto: new Map([[3, 0]]) }))).toEqual({ taxa: 0, origem_taxa: "produto" });
  });
});

describe("calcularComissao", () => {
  it("calcula item a item sobre o valor das peças e arredonda centavos", () => {
    const calculo = calcularComissao(
      [
        { id_produto: 1, id_categoria: 5, nome_produto: "A", quantidade: 1, valor: 69.9 },
        { id_produto: 2, id_categoria: 5, nome_produto: "B", quantidade: 2, valor: 139.8 },
      ],
      regras(),
    );

    expect(calculo.itens.map((i) => i.valor_comissao)).toEqual([13.98, 16.78]);
    expect(calculo.valor_comissionavel).toBe(209.7);
    expect(calculo.valor_comissao).toBe(30.76);
  });
});

describe("statusPelaSituacaoDoPedido", () => {
  it.each([
    ["aguardando_pagamento", "aguardando_pagamento"],
    ["aguardando_calculo_frete", "aguardando_pagamento"],
    ["pago", "pendente"],
    ["enviado", "pendente"],
    ["entregue", "pendente"],
    ["cancelado", "cancelada"],
  ])("%s -> %s", (pedido, comissao) => {
    expect(statusPelaSituacaoDoPedido(pedido)).toBe(comissao);
  });
});
