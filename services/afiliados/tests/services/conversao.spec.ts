import { AfiliadoCliques, Afiliados, ConversaoItens, Conversoes } from "../../src/models";
import ConversaoService from "../../src/services/conversao.service";
import { assinarReferencia } from "../../src/utils/seguranca";

jest.mock("@agnus/comum/config/database", () => ({
  __esModule: true,
  default: { transaction: jest.fn((fn: (t: object) => unknown) => fn({})) },
}));
jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("../../src/services/catalogo.service", () => ({
  produtosDoCatalogo: jest.fn().mockResolvedValue([{ id_produto: 1, id_categoria: 5, nome: "Camiseta" }]),
}));
jest.mock("../../src/models", () => ({
  Conversoes: { findOne: jest.fn(), create: jest.fn(), update: jest.fn() },
  ConversaoItens: { bulkCreate: jest.fn() },
  AfiliadoCliques: { findByPk: jest.fn() },
  Afiliados: { findByPk: jest.fn() },
  RegrasComissao: { findAll: jest.fn().mockResolvedValue([]) },
}));

const m = {
  conversaoFindOne: Conversoes.findOne as jest.Mock,
  conversaoCreate: Conversoes.create as jest.Mock,
  conversaoUpdate: Conversoes.update as jest.Mock,
  itens: ConversaoItens.bulkCreate as jest.Mock,
  clique: AfiliadoCliques.findByPk as jest.Mock,
  afiliado: Afiliados.findByPk as jest.Mock,
};

const AGORA = Date.now();
const ref = (id = 9) => assinarReferencia(id, Math.floor(AGORA / 1000) + 3600);
const pedido = (extra = {}) => ({
  id_pedido: 100,
  id_usuario: 50,
  status: "aguardando_pagamento",
  ref: ref(),
  valor_total: 139.8,
  data_pedido: new Date(AGORA).toISOString(),
  itens: [{ id_produto: 1, quantidade: 2, subtotal: 139.8 }],
  ...extra,
});

beforeAll(() => {
  process.env.AFILIADOS_SEGREDO = "segredo-de-teste-com-mais-de-32-caracteres!!";
});

beforeEach(() => {
  jest.clearAllMocks();
  m.conversaoFindOne.mockResolvedValue(null);
  m.conversaoCreate.mockImplementation(async (dados) => ({ id_conversao: 1, ...dados }));
  m.clique.mockResolvedValue({ id_clique: 9, id_link: 3, id_afiliado: 7, data_criacao: new Date(AGORA - 60_000) });
  m.afiliado.mockResolvedValue({ id_afiliado: 7, id_usuario: 99, status: "ativo", taxa_personalizada: null });
});

describe("ConversaoService.registrar", () => {
  it("atribui ao afiliado do clique e calcula a comissão padrão (10%)", async () => {
    const resultado = await ConversaoService.registrar(pedido());

    expect(resultado).toEqual({ atribuido: true, id_conversao: 1, status: "aguardando_pagamento", valor_comissao: 13.98 });
    expect(m.conversaoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id_pedido: 100, id_afiliado: 7, id_link: 3, id_clique: 9, valor_comissionavel: 139.8, valor_comissao: 13.98 }),
      expect.anything(),
    );
    expect(m.itens).toHaveBeenCalledWith([expect.objectContaining({ id_produto: 1, id_categoria: 5, taxa: 10, origem_taxa: "padrao" })], expect.anything());
  });

  it("sem cookie válido não atribui", async () => {
    expect(await ConversaoService.registrar(pedido({ ref: "1.2.forjado" }))).toEqual({ atribuido: false, motivo: "sem_clique_valido" });
    expect(m.conversaoCreate).not.toHaveBeenCalled();
  });

  it("clique mais antigo que a janela de atribuição não conta", async () => {
    m.clique.mockResolvedValue({ id_clique: 9, id_link: 3, id_afiliado: 7, data_criacao: new Date(AGORA - 8 * 86400000) });
    expect(await ConversaoService.registrar(pedido())).toEqual({ atribuido: false, motivo: "fora_da_janela" });
  });

  it("afiliado suspenso não ganha comissão", async () => {
    m.afiliado.mockResolvedValue({ id_afiliado: 7, id_usuario: 99, status: "suspenso" });
    expect(await ConversaoService.registrar(pedido())).toEqual({ atribuido: false, motivo: "afiliado_inativo" });
  });

  it("compra do próprio afiliado fica registrada como cancelada", async () => {
    m.afiliado.mockResolvedValue({ id_afiliado: 7, id_usuario: 50, status: "ativo", taxa_personalizada: null });
    const resultado = await ConversaoService.registrar(pedido());

    expect(resultado).toMatchObject({ atribuido: true, status: "cancelada" });
    expect(m.conversaoCreate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "cancelada", motivo_cancelamento: "Compra feita pelo próprio afiliado" }),
      expect.anything(),
    );
  });

  it("é idempotente: pedido já registrado só atualiza o status", async () => {
    const existente = { id_conversao: 5, status: "pendente", valor_comissao: "13.98", motivo_cancelamento: null, update: jest.fn() };
    m.conversaoFindOne.mockResolvedValue(existente);

    expect(await ConversaoService.registrar(pedido({ status: "pago" }))).toMatchObject({ atribuido: true, id_conversao: 5 });
    expect(m.conversaoCreate).not.toHaveBeenCalled();
  });
});

describe("ConversaoService.atualizarStatus", () => {
  const conversao = (status: string, extra = {}) => ({ id_conversao: 1, status, motivo_cancelamento: null, data_entrega: null, liberada_em: null, update: jest.fn(), ...extra });

  it("pedido pago -> comissão pendente", async () => {
    const c = conversao("aguardando_pagamento");
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.atualizarStatus(100, "pago");
    expect(c.update).toHaveBeenCalledWith({ status_pedido: "pago", status: "pendente" });
  });

  it("entregue -> continua pendente e libera depois do prazo de arrependimento (7 dias)", async () => {
    const c = conversao("pendente");
    m.conversaoFindOne.mockResolvedValue(c);
    const agora = new Date("2026-11-20T12:00:00Z");
    await ConversaoService.atualizarStatus(100, "entregue", agora);
    expect(c.update).toHaveBeenCalledWith({
      status_pedido: "entregue",
      status: "pendente",
      data_entrega: agora,
      liberada_em: new Date("2026-11-27T12:00:00Z"),
    });
  });

  it("cancelado -> comissão cancelada", async () => {
    const c = conversao("pendente");
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.atualizarStatus(100, "cancelado");
    expect(c.update).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelada", motivo_cancelamento: "Pedido cancelado" }));
  });

  it("comissão já paga não muda", async () => {
    const c = conversao("paga");
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.atualizarStatus(100, "cancelado");
    expect(c.update).toHaveBeenCalledWith({ status_pedido: "cancelado" });
  });

  it("autoindicação continua cancelada mesmo que o pedido seja pago", async () => {
    const c = conversao("cancelada", { motivo_cancelamento: "Compra feita pelo próprio afiliado" });
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.atualizarStatus(100, "pago");
    expect(c.update).toHaveBeenCalledWith({ status_pedido: "pago" });
  });

  it("aprova as comissões cujo prazo passou", async () => {
    m.conversaoUpdate.mockResolvedValue([3]);
    expect(await ConversaoService.aprovarLiberadas(new Date())).toBe(3);
    expect(m.conversaoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "aprovada" }),
      expect.objectContaining({ where: expect.objectContaining({ status: "pendente" }) }),
    );
  });
});

describe("ConversaoService.aplicarDevolucao", () => {
  const entrega = new Date("2026-11-20T12:00:00Z");
  const conversao = (extra = {}) => ({
    id_conversao: 1,
    status: "pendente",
    valor_comissao: "20.97",
    valor_comissionavel: "139.80",
    data_entrega: entrega,
    itens: [{ id_produto: 1, taxa: "15.00" }],
    update: jest.fn(),
    ...extra,
  });

  beforeEach(() => m.conversaoUpdate.mockResolvedValue([0]));

  it("devolução aberta segura a comissão (sem data de liberação)", async () => {
    const c = conversao();
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.aplicarDevolucao(100, "aberta", []);
    expect(c.update).toHaveBeenCalledWith({ status: "pendente", liberada_em: null, data_aprovacao: null });
  });

  it("devolução recusada ou cancelada volta a contar o prazo da entrega", async () => {
    const c = conversao({ liberada_em: null });
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.aplicarDevolucao(100, "encerrada", []);
    expect(c.update).toHaveBeenCalledWith({ status: "pendente", liberada_em: new Date("2026-11-27T12:00:00Z") });
  });

  it("reembolso parcial desconta a comissão das peças devolvidas com a taxa gravada", async () => {
    const c = conversao();
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.aplicarDevolucao(100, "reembolsada", [{ id_produto: 1, valor: 69.9 }]);
    expect(c.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pendente", valor_comissao: 10.48, valor_comissionavel: 69.9 }));
  });

  it("devolveu tudo: comissão cancelada", async () => {
    const c = conversao();
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.aplicarDevolucao(100, "reembolsada", [{ id_produto: 1, valor: 139.8 }]);
    expect(c.update).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelada", valor_comissao: 0, motivo_cancelamento: "Peças devolvidas" }));
  });

  it("comissão já paga não é alterada", async () => {
    const c = conversao({ status: "paga" });
    m.conversaoFindOne.mockResolvedValue(c);
    await ConversaoService.aplicarDevolucao(100, "reembolsada", [{ id_produto: 1, valor: 139.8 }]);
    expect(c.update).not.toHaveBeenCalled();
  });
});
