import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import { DevolucaoFotos, DevolucaoItens, Devolucoes } from "../../src/models/Devolucoes";
import { gravarFoto } from "../../src/utils/devolucaoFotoStorage";
import Pagamentos from "../../src/models/Pagamentos";
import PedidoItens from "../../src/models/PedidoItens";
import Pedidos from "../../src/models/Pedidos";
import { criarReembolso } from "../../src/pagamentos/mercadoPago";
import DevolucaoService from "../../src/services/devolucao.service";

jest.mock("@agnus/comum/config/database", () => ({
  __esModule: true,
  default: { transaction: jest.fn((fn: (t: object) => unknown) => fn({ LOCK: { UPDATE: "UPDATE" } })) },
}));
jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@agnus/comum/utils/clienteInterno", () => ({ chamarServico: jest.fn().mockResolvedValue({ status: 204, data: {} }) }));
jest.mock("@agnus/comum/utils/itemDetails", () => ({
  enrichItemsWithProductData: jest.fn(async (itens: { id_pedido_item: number }[]) =>
    itens.map((i) => ({ ...i, produto: { id_produto: 100 + i.id_pedido_item, nome: `Peça ${i.id_pedido_item}` }, cor: { nome: "Preto" }, grade: { nome: "M" }, foto_produto: null })),
  ),
}));
jest.mock("../../src/pagamentos/mercadoPago", () => ({ criarReembolso: jest.fn() }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/PedidoItens", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../../src/models/Pagamentos", () => ({ __esModule: true, default: { findOne: jest.fn() } }));
jest.mock("../../src/models/Devolucoes", () => ({
  Devolucoes: { findOne: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn(), findAndCountAll: jest.fn() },
  DevolucaoItens: { findAll: jest.fn(), bulkCreate: jest.fn() },
  DevolucaoFotos: { create: jest.fn(), findByPk: jest.fn() },
}));
jest.mock("../../src/utils/devolucaoFotoStorage", () => ({
  ...jest.requireActual("../../src/utils/devolucaoFotoStorage"),
  gravarFoto: jest.fn().mockResolvedValue("0a1b2c3d-1111-2222-3333-444455556666.png"),
  apagarFoto: jest.fn(),
}));

const m = {
  pedido: Pedidos.findByPk as jest.Mock,
  itens: PedidoItens.findAll as jest.Mock,
  devFindOne: Devolucoes.findOne as jest.Mock,
  devFindAll: Devolucoes.findAll as jest.Mock,
  devFindByPk: Devolucoes.findByPk as jest.Mock,
  devCreate: Devolucoes.create as jest.Mock,
  devUpdate: Devolucoes.update as jest.Mock,
  devItensFindAll: DevolucaoItens.findAll as jest.Mock,
  devItensCreate: DevolucaoItens.bulkCreate as jest.Mock,
  pagamento: Pagamentos.findOne as jest.Mock,
  reembolso: criarReembolso as jest.Mock,
  chamar: chamarServico as jest.Mock,
};

const DIA = 86400000;
const pedido = (extra = {}) => ({
  id_pedido: 10,
  id_usuario: 5,
  status: "entregue",
  valor_frete: 15,
  ref_afiliado: null,
  data_entrega: new Date(Date.now() - 2 * DIA),
  ...extra,
});
const itensDoPedido = [
  { id_pedido_item: 1, id_pedido: 10, quantidade: 2, preco_unitario: "69.90", id_produto_cor: 1, id_produto_grade: 1 },
  { id_pedido_item: 2, id_pedido: 10, quantidade: 1, preco_unitario: "119.90", id_produto_cor: 2, id_produto_grade: 2 },
];
const devolucao = (extra = {}) => ({
  id_devolucao: 7,
  id_pedido: 10,
  id_usuario: 5,
  status: "solicitada",
  motivo: "arrependimento",
  valor_reembolso: "69.90",
  itens: [{ id_pedido_item: 1, quantidade: 1, valor: "69.90" }],
  ...extra,
});
const cliente = { id_usuario: 5 };

beforeEach(() => {
  jest.clearAllMocks();
  m.pedido.mockResolvedValue(pedido());
  m.itens.mockResolvedValue(itensDoPedido);
  m.devFindOne.mockResolvedValue(null);
  m.devFindAll.mockResolvedValue([]);
  m.devItensFindAll.mockResolvedValue([]);
  m.devCreate.mockImplementation(async (dados) => ({ id_devolucao: 7, ...dados }));
  m.devFindByPk.mockImplementation(async () => devolucao());
  m.devUpdate.mockResolvedValue([1]);
});

describe("opcoes", () => {
  it("pedido entregue há 2 dias: todos os motivos disponíveis e peças devolvíveis", async () => {
    const opcoes = await DevolucaoService.opcoes(10, cliente);
    expect(opcoes.elegivel).toBe(true);
    expect(opcoes.motivos.every((mot) => mot.disponivel)).toBe(true);
    expect(opcoes.itens.map((i) => [i.id_pedido_item, i.quantidade_devolvivel, i.nome_produto])).toEqual([[1, 2, "Peça 1"], [2, 1, "Peça 2"]]);
  });

  it("depois de 7 dias: só defeito e peça errada continuam (90 dias)", async () => {
    m.pedido.mockResolvedValue(pedido({ data_entrega: new Date(Date.now() - 10 * DIA) }));
    const opcoes = await DevolucaoService.opcoes(10, cliente);
    expect(opcoes.motivos.filter((mot) => mot.disponivel).map((mot) => mot.valor)).toEqual(["defeito", "produto_errado"]);
  });

  it("pedido ainda não entregue não é elegível", async () => {
    m.pedido.mockResolvedValue(pedido({ status: "enviado", data_entrega: null }));
    const opcoes = await DevolucaoService.opcoes(10, cliente);
    expect(opcoes.elegivel).toBe(false);
    expect(opcoes.motivo_inelegivel).toMatch(/entregue/);
  });

  it("pedido de outra pessoa: 404", async () => {
    await expect(DevolucaoService.opcoes(10, { id_usuario: 99 })).rejects.toMatchObject({ status: 404 });
  });
});

describe("solicitar", () => {
  it("calcula o reembolso das peças escolhidas (sem frete se não for tudo)", async () => {
    await DevolucaoService.solicitar(10, cliente, { motivo: "arrependimento", itens: [{ id_pedido_item: 1, quantidade: 1 }] });
    expect(m.devCreate).toHaveBeenCalledWith(expect.objectContaining({ valor_reembolso: 69.9, status: "solicitada" }), expect.anything());
    expect(m.devItensCreate).toHaveBeenCalledWith([{ id_pedido_item: 1, quantidade: 1, valor: 69.9, id_devolucao: 7 }], expect.anything());
    expect(m.chamar).toHaveBeenCalledWith("notificacoes", "/devolucao", expect.objectContaining({ body: expect.objectContaining({ status: "solicitada" }) }));
  });

  it("devolvendo todas as peças, o frete volta junto", async () => {
    await DevolucaoService.solicitar(10, cliente, {
      motivo: "tamanho",
      itens: [{ id_pedido_item: 1, quantidade: 2 }, { id_pedido_item: 2, quantidade: 1 }],
    });
    expect(m.devCreate).toHaveBeenCalledWith(expect.objectContaining({ valor_reembolso: 274.7 }), expect.anything());
  });

  it("não deixa devolver mais do que comprou (descontando devoluções anteriores)", async () => {
    m.devFindAll.mockResolvedValue([{ id_devolucao: 3 }]);
    m.devItensFindAll.mockResolvedValue([{ id_pedido_item: 1, quantidade: 2 }]);
    await expect(
      DevolucaoService.solicitar(10, cliente, { motivo: "arrependimento", itens: [{ id_pedido_item: 1, quantidade: 1 }] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("fora do prazo de arrependimento: 409", async () => {
    m.pedido.mockResolvedValue(pedido({ data_entrega: new Date(Date.now() - 8 * DIA) }));
    await expect(
      DevolucaoService.solicitar(10, cliente, { motivo: "arrependimento", itens: [{ id_pedido_item: 1 }] }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("defeito exige descrever o problema", async () => {
    await expect(
      DevolucaoService.solicitar(10, cliente, { motivo: "defeito", descricao: "ruim", itens: [{ id_pedido_item: 1 }] }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("só uma devolução em andamento por pedido", async () => {
    m.devFindOne.mockResolvedValue(devolucao());
    await expect(
      DevolucaoService.solicitar(10, cliente, { motivo: "arrependimento", itens: [{ id_pedido_item: 1 }] }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("pedido com afiliado: avisa o programa para segurar a comissão", async () => {
    m.pedido.mockResolvedValue(pedido({ ref_afiliado: "1.2.x" }));
    await DevolucaoService.solicitar(10, cliente, { motivo: "arrependimento", itens: [{ id_pedido_item: 1, quantidade: 1 }] });
    expect(m.chamar).toHaveBeenCalledWith("afiliados", "/conversoes/devolucao", {
      method: "POST",
      body: { id_pedido: 10, evento: "aberta", itens: [{ id_produto: 101, valor: 69.9 }] },
    });
  });
});

describe("fluxo da equipe", () => {
  it("aprovar exige instruções e grava o código de postagem", async () => {
    await expect(DevolucaoService.aprovar(7, { resposta_loja: "" })).rejects.toMatchObject({ status: 400 });
    await DevolucaoService.aprovar(7, { resposta_loja: "Poste nos Correios", codigo_postagem: "ABC123" });
    expect(m.devUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "aprovada", resposta_loja: "Poste nos Correios", codigo_postagem: "ABC123" }),
      { where: { id_devolucao: 7, status: "solicitada" } },
    );
  });

  it("não pula etapas: reembolsar antes de receber a peça dá 409", async () => {
    await expect(DevolucaoService.reembolsar(7, {})).rejects.toMatchObject({ status: 409 });
  });

  it("dois cliques ao mesmo tempo: o segundo recebe 409", async () => {
    m.devUpdate.mockResolvedValueOnce([0]);
    await expect(DevolucaoService.aprovar(7, { resposta_loja: "Poste nos Correios" })).rejects.toMatchObject({ status: 409 });
  });

  it("reembolso pelo Mercado Pago estorna o valor no pagamento aprovado", async () => {
    m.devFindByPk.mockImplementation(async () => devolucao({ status: "recebida" }));
    m.pagamento.mockResolvedValue({ mp_payment_id: "999", valor: "154.80" });
    m.reembolso.mockResolvedValue({ id: 555, status: "approved", amount: 69.9 });

    await DevolucaoService.reembolsar(7, { forma: "mercado_pago" });
    expect(m.reembolso).toHaveBeenCalledWith("999", 69.9, "devolucao-7");
    expect(m.devUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: "reembolsada", forma_reembolso: "mercado_pago", referencia_reembolso: "MP-555" }),
      expect.anything(),
    );
  });

  it("reembolso manual exige a referência e não chama o Mercado Pago", async () => {
    m.devFindByPk.mockImplementation(async () => devolucao({ status: "recebida" }));
    await expect(DevolucaoService.reembolsar(7, { forma: "manual" })).rejects.toMatchObject({ status: 400 });
    await DevolucaoService.reembolsar(7, { forma: "manual", referencia: "PIX-123" });
    expect(m.reembolso).not.toHaveBeenCalled();
    expect(m.devUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "reembolsada", referencia_reembolso: "PIX-123" }), expect.anything());
  });

  it("sem pagamento aprovado no Mercado Pago, orienta o reembolso manual", async () => {
    m.devFindByPk.mockImplementation(async () => devolucao({ status: "recebida" }));
    m.pagamento.mockResolvedValue(null);
    await expect(DevolucaoService.reembolsar(7, { forma: "mercado_pago" })).rejects.toMatchObject({ status: 409 });
  });

  it("cliente só cancela enquanto está em análise, e só a própria", async () => {
    await expect(DevolucaoService.cancelar(7, { id_usuario: 99 })).rejects.toMatchObject({ status: 404 });
    m.devFindByPk.mockImplementation(async () => devolucao({ status: "aprovada" }));
    await expect(DevolucaoService.cancelar(7, cliente)).rejects.toMatchObject({ status: 409 });
  });
});

describe("fotos da devolução", () => {
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).toString("base64");
  const fotoCreate = DevolucaoFotos.create as jest.Mock;
  const fotoFind = DevolucaoFotos.findByPk as jest.Mock;

  it("dono anexa foto enquanto está em análise; a resposta traz a URL protegida, não o arquivo", async () => {
    m.devFindByPk.mockImplementation(async () => devolucao({ fotos: [{ id_devolucao_foto: 4, arquivo: "segredo.png" }] }));
    const resposta = await DevolucaoService.enviarFoto(7, cliente, { foto: `data:image/png;base64,${PNG}` });
    expect(gravarFoto).toHaveBeenCalled();
    expect(fotoCreate).toHaveBeenCalledWith(expect.objectContaining({ id_devolucao: 7, tipo: "png" }));
    expect(resposta.fotos).toEqual([{ id_devolucao_foto: 4, url: "/api/devolucao-fotos/4" }]);
    expect(JSON.stringify(resposta)).not.toContain("segredo.png");
  });

  it("não anexa em devolução de outra pessoa, depois de respondida ou acima de 3 fotos", async () => {
    await expect(DevolucaoService.enviarFoto(7, { id_usuario: 99 }, { foto: PNG })).rejects.toMatchObject({ status: 404 });
    m.devFindByPk.mockImplementation(async () => devolucao({ status: "aprovada" }));
    await expect(DevolucaoService.enviarFoto(7, cliente, { foto: PNG })).rejects.toMatchObject({ status: 409 });
    m.devFindByPk.mockImplementation(async () => devolucao({ fotos: [{}, {}, {}] }));
    await expect(DevolucaoService.enviarFoto(7, cliente, { foto: PNG })).rejects.toMatchObject({ status: 409 });
  });

  it("foto só abre para o dono ou para a equipe; para outro cliente é 404", async () => {
    fotoFind.mockResolvedValue({ id_devolucao_foto: 4, id_devolucao: 7, arquivo: "0a1b2c3d-1111-2222-3333-444455556666.png" });
    m.devFindByPk.mockResolvedValue(devolucao());

    await expect(DevolucaoService.lerFoto(4, { id_usuario: 5, email: "a@b.com", tipo: "cliente" } as never)).resolves.toMatchObject({ tipo: "image/png" });
    await expect(DevolucaoService.lerFoto(4, { id_usuario: 1, email: "adm@b.com", tipo: "administrador" } as never)).resolves.toMatchObject({ tipo: "image/png" });
    await expect(DevolucaoService.lerFoto(4, { id_usuario: 99, email: "x@b.com", tipo: "cliente" } as never)).rejects.toMatchObject({ status: 404 });
  });
});
