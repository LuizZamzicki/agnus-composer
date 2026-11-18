import EventBusService from "@agnus/comum/services/eventBus.service";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import { buscarPedidoYouDraw, criarPedidoYouDraw, ErroYouDraw } from "@agnus/comum/utils/youdraw";
import YouDrawService, { montarPedidoYouDraw, PedidosFornecedor } from "../../src/fornecedor/youdraw.service";
import PedidoItens from "../../src/models/PedidoItens";
import Pedidos from "../../src/models/Pedidos";
import AvisoPedidoService from "../../src/services/avisoPedido.service";

jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@agnus/comum/services/eventBus.service", () => ({ __esModule: true, default: { publish: jest.fn() } }));
jest.mock("@agnus/comum/utils/clienteInterno", () => ({ chamarServico: jest.fn() }));
jest.mock("@agnus/comum/utils/youdraw", () => {
  const real = jest.requireActual("@agnus/comum/utils/youdraw");
  return { ...real, criarPedidoYouDraw: jest.fn(), buscarPedidoYouDraw: jest.fn() };
});
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/PedidoItens", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../../src/services/avisoPedido.service", () => ({ __esModule: true, default: { avisarMudancaDeStatus: jest.fn() } }));

const m = {
  pedido: Pedidos.findByPk as jest.Mock,
  itens: PedidoItens.findAll as jest.Mock,
  chamar: chamarServico as jest.Mock,
  criar: criarPedidoYouDraw as jest.Mock,
  buscar: buscarPedidoYouDraw as jest.Mock,
  publicar: EventBusService.publish as jest.Mock,
  aviso: AvisoPedidoService.avisarMudancaDeStatus as jest.Mock,
};
const findOrCreate = jest.spyOn(PedidosFornecedor, "findOrCreate");
const findAllRegistros = jest.spyOn(PedidosFornecedor, "findAll");

const AMBIENTE = { ...process.env };
const ENTREGA = {
  nome: "Ana Souza",
  cpf: "123.456.789-09",
  email: "ana@teste.com",
  telefone: "(44) 99999-1234",
  endereco: { cep: "87355-000", logradouro: "Rua das Flores", numero: "100", complemento: null, bairro: "Centro", cidade: "Goioerê", estado: "PR" },
};
const pedidoDb = (extra = {}) => {
  const p = { id_pedido: 21, id_usuario: 5, id_usuario_endereco: 9, status: "pago", codigo_rastreio: null, data_entrega: null, ...extra } as Record<string, unknown>;
  p.update = jest.fn(async (dados: Record<string, unknown>) => Object.assign(p, dados));
  return p;
};
const registroDb = (extra = {}) => {
  const r = { id_pedido: 21, situacao: "aguardando", chave_idempotencia: "chave-original", tentativas: 0, status_externo: null, codigo_publico: null, ...extra } as Record<string, unknown>;
  r.update = jest.fn(async (dados: Record<string, unknown>) => Object.assign(r, dados));
  return r;
};
const PEDIDO_YD = {
  id: "ord_123",
  number: 4521,
  public_code: "YD-ABC23",
  status: "pending_payment",
  amounts: { subtotal_cents: 3160, shipping_cents: 1890, total_cents: 5050, currency: "BRL" },
  shipments: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...AMBIENTE, YOUDRAW_API_KEY: "yd_live_chaveDeTeste123" };
  m.itens.mockResolvedValue([
    { id_produto_cor: 1, id_produto_grade: 2, quantidade: 1 },
    { id_produto_cor: 1, id_produto_grade: 2, quantidade: 2 },
    { id_produto_cor: 3, id_produto_grade: 4, quantidade: 1 },
  ]);
  m.chamar.mockImplementation(async (servico: string) =>
    servico === "identidade"
      ? { status: 200, data: ENTREGA }
      : {
          status: 200,
          data: [
            { id_produto_cor: 1, id_produto_grade: 2, id_produto: 1, cor: "Preto", tamanho: "M", sku: "DRY-PRETO-M" },
            { id_produto_cor: 1, id_produto_grade: 2, id_produto: 1, cor: "Preto", tamanho: "M", sku: "DRY-PRETO-M" },
            { id_produto_cor: 3, id_produto_grade: 4, id_produto: 4, cor: "Preto", tamanho: "G", sku: "TANK-PRETO-G" },
          ],
        },
  );
});

afterAll(() => {
  process.env = AMBIENTE;
});

describe("montarPedidoYouDraw", () => {
  it("monta o pedido como a documentação pede: CPF e CEP só dígitos, telefone +55, SKUs somados", async () => {
    const corpo = await montarPedidoYouDraw(pedidoDb() as never);
    expect(corpo).toEqual({
      external_reference: "agnus-21",
      customer: {
        name: "Ana Souza",
        document: "12345678909",
        email: "ana@teste.com",
        phone: "+5544999991234",
        address: { postal_code: "87355000", street: "Rua das Flores", number: "100", complement: null, neighborhood: "Centro", city: "Goioerê", state: "PR" },
      },
      items: [
        { sku: "DRY-PRETO-M", quantity: 3 },
        { sku: "TANK-PRETO-G", quantity: 1 },
      ],
      notes: "Pedido #21 da loja Agnus.",
    });
  });

  it("peça sem SKU ligado: erro claro, sem chamar a YouDraw", async () => {
    m.chamar.mockImplementation(async (servico: string) =>
      servico === "identidade" ? { data: ENTREGA } : { data: [{ id_produto_cor: 1, id_produto_grade: 2, id_produto: 1, cor: "Preto", tamanho: "M", sku: null }] },
    );
    await expect(montarPedidoYouDraw(pedidoDb() as never)).rejects.toMatchObject({ codigo: "sku_ausente", message: expect.stringContaining("Preto / M (produto 1)") });
  });

  it("cliente sem CPF ou sem número: dados incompletos, dizendo o que falta", async () => {
    const skus = (await m.chamar("catalogo")).data;
    m.chamar.mockImplementation(async (servico: string) =>
      servico === "identidade" ? { data: { ...ENTREGA, cpf: null, endereco: { ...ENTREGA.endereco, numero: "" } } } : { data: skus },
    );
    await expect(montarPedidoYouDraw(pedidoDb() as never)).rejects.toMatchObject({ codigo: "dados_incompletos", message: expect.stringMatching(/CPF, número/) });
  });

  it("pedido sem itens não vai", async () => {
    m.itens.mockResolvedValue([]);
    await expect(montarPedidoYouDraw(pedidoDb() as never)).rejects.toMatchObject({ codigo: "pedido_sem_itens" });
  });
});

describe("YouDrawService.enviar", () => {
  it("cria o pedido na YouDraw com a chave guardada e registra o código YD", async () => {
    const pedido = pedidoDb();
    const registro = registroDb();
    m.pedido.mockResolvedValue(pedido);
    findOrCreate.mockResolvedValue([registro as never, true]);
    m.criar.mockResolvedValue(PEDIDO_YD);

    await YouDrawService.enviar(21);

    expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({ external_reference: "agnus-21" }), "chave-original");
    expect(registro).toMatchObject({ situacao: "enviado", id_externo: "ord_123", codigo_publico: "YD-ABC23", status_externo: "pending_payment", total_centavos: 5050, frete_centavos: 1890 });
    expect(pedido.codigo_rastreio).toBe("YD-ABC23");
    expect(m.publicar).toHaveBeenCalledWith("fornecedor.pedido_criado", expect.objectContaining({ id_pedido: 21, codigo_publico: "YD-ABC23" }));
  });

  it("pedido já enviado não é enviado de novo", async () => {
    m.pedido.mockResolvedValue(pedidoDb());
    findOrCreate.mockResolvedValue([registroDb({ situacao: "enviado" }) as never, false]);
    await YouDrawService.enviar(21);
    expect(m.criar).not.toHaveBeenCalled();
  });

  it("pedido não pago não vai para a YouDraw", async () => {
    m.pedido.mockResolvedValue(pedidoDb({ status: "aguardando_pagamento" }));
    await expect(YouDrawService.enviar(21)).rejects.toMatchObject({ status: 409 });
  });

  it("integração desligada: fica para fazer no painel, sem chamar nada", async () => {
    delete process.env.YOUDRAW_API_KEY;
    const registro = registroDb();
    m.pedido.mockResolvedValue(pedidoDb());
    findOrCreate.mockResolvedValue([registro as never, true]);
    await YouDrawService.enviar(21);
    expect(registro).toMatchObject({ situacao: "manual", erro_codigo: "integracao_desligada" });
    expect(m.criar).not.toHaveBeenCalled();
  });

  it("sem resposta / 5xx: tenta de novo depois com a MESMA chave (o pedido pode ter sido criado lá)", async () => {
    const registro = registroDb();
    m.pedido.mockResolvedValue(pedidoDb());
    findOrCreate.mockResolvedValue([registro as never, true]);
    m.criar.mockRejectedValue(new ErroYouDraw(503, "api_unavailable", "fora do ar"));
    await YouDrawService.enviar(21);
    expect(registro).toMatchObject({ situacao: "erro", erro_codigo: "api_unavailable", retentavel: true, tentativas: 1, chave_idempotencia: "chave-original" });
  });

  it("recusa de validação (422): não repete sozinho e a próxima tentativa usa chave nova", async () => {
    const registro = registroDb();
    m.pedido.mockResolvedValue(pedidoDb());
    findOrCreate.mockResolvedValue([registro as never, true]);
    m.criar.mockRejectedValue(new ErroYouDraw(422, "validation_error", "SKU de outra conta"));
    await YouDrawService.enviar(21);
    expect(registro).toMatchObject({ situacao: "erro", retentavel: false });
    expect(registro.chave_idempotencia).not.toBe("chave-original");
    expect(m.publicar).toHaveBeenCalledWith("fornecedor.pedido_falhou", expect.objectContaining({ codigo: "validation_error", retentavel: false }));
  });
});

describe("status da YouDraw refletido na loja", () => {
  it("enviado lá: o pedido daqui vira 'enviado' (com aviso ao cliente)", async () => {
    const pedido = pedidoDb();
    m.pedido.mockResolvedValue(pedido);
    const registro = registroDb({ situacao: "enviado", status_externo: "in_production", codigo_publico: "YD-ABC23" });
    await YouDrawService.gravarPedidoYouDraw(registro as never, {
      ...PEDIDO_YD,
      status: "shipped",
      shipments: [{ tracking_code: "BR123", carrier: "Correios", provider: "youdraw_shipping", tracking_url: "https://rastreio/BR123" }],
    } as never);

    expect(pedido.status).toBe("enviado");
    expect(m.aviso).toHaveBeenCalledWith(pedido, "pago");
    expect(registro).toMatchObject({ rastreio_codigo: "BR123", rastreio_url: "https://rastreio/BR123", status_externo: "shipped" });
    expect(m.publicar).toHaveBeenCalledWith("fornecedor.status", expect.objectContaining({ status_externo: "shipped", status_anterior: "in_production" }));
  });

  it("entregue lá com o pedido ainda 'pago' aqui: passa por enviado e depois entregue", async () => {
    const pedido = pedidoDb();
    m.pedido.mockResolvedValue(pedido);
    await YouDrawService.gravarPedidoYouDraw(registroDb({ situacao: "enviado" }) as never, { ...PEDIDO_YD, status: "delivered" } as never);
    expect(m.aviso.mock.calls.map(([, anterior]) => anterior)).toEqual(["pago", "enviado"]);
    expect(pedido.status).toBe("entregue");
    expect(pedido.data_entrega).toBeInstanceOf(Date);
  });

  it("cancelado lá não cancela sozinho aqui (a equipe decide); só registra", async () => {
    const pedido = pedidoDb();
    m.pedido.mockResolvedValue(pedido);
    await YouDrawService.gravarPedidoYouDraw(registroDb({ situacao: "enviado", status_externo: "pending_payment" }) as never, { ...PEDIDO_YD, status: "canceled" } as never);
    expect(pedido.status).toBe("pago");
    expect(m.publicar).toHaveBeenCalledWith("fornecedor.status", expect.objectContaining({ status_externo: "canceled" }));
  });

  it("webhook de pedido que não é desta loja é ignorado", async () => {
    jest.spyOn(PedidosFornecedor, "findOne").mockResolvedValue(null);
    jest.spyOn(PedidosFornecedor, "findByPk").mockResolvedValue(null);
    const r = await YouDrawService.aplicarEvento({ type: "order.status_changed", data: { object: "order", order: { ...PEDIDO_YD, external_reference: "outra-loja-9" } } } as never);
    expect(r).toEqual({ aplicado: false, motivo: "pedido não é desta loja" });
  });
});

describe("rotina de sincronização", () => {
  it("só tenta de novo o que a integração começou; não pega pedido pago antigo", async () => {
    findAllRegistros.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await YouDrawService.sincronizar();
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.pedido).not.toHaveBeenCalled();
    const filtro = findAllRegistros.mock.calls[0][0] as { where: Record<symbol, unknown> };
    expect(JSON.stringify(Object.getOwnPropertySymbols(filtro.where).map((s) => filtro.where[s]))).toContain("aguardando");
  });

  it("consulta o status dos pedidos abertos lá (reconciliação, sem depender do webhook)", async () => {
    const registro = registroDb({ situacao: "enviado", id_externo: "ord_123", status_externo: "paid" });
    findAllRegistros.mockResolvedValueOnce([]).mockResolvedValueOnce([registro as never]);
    m.buscar.mockResolvedValue({ ...PEDIDO_YD, status: "in_production" });
    m.pedido.mockResolvedValue(pedidoDb());
    const r = await YouDrawService.sincronizar();
    expect(m.buscar).toHaveBeenCalledWith("ord_123");
    expect(r.atualizados).toBe(1);
    expect(registro.status_externo).toBe("in_production");
  });
});
