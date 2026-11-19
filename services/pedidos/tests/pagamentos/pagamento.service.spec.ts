import EventBusService from "@agnus/comum/services/eventBus.service";
import Pagamentos from "../../src/models/Pagamentos";
import Pedidos from "../../src/models/Pedidos";
import { definirConfiguracaoMercadoPago } from "../../src/pagamentos/mercadoPago";
import PagamentoService from "../../src/pagamentos/pagamento.service";
import AvisoPedidoService from "../../src/services/avisoPedido.service";

jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { findByPk: jest.fn() } }));
jest.mock("../../src/models/Pagamentos", () => ({ __esModule: true, default: { findOne: jest.fn(), create: jest.fn() } }));
jest.mock("@agnus/comum/services/eventBus.service", () => ({ __esModule: true, default: { publish: jest.fn() } }));
jest.mock("../../src/services/avisoPedido.service", () => ({ __esModule: true, default: { avisarMudancaDeStatus: jest.fn() } }));

const mocks = {
  pedido: Pedidos.findByPk as unknown as jest.Mock,
  pagamentoFindOne: Pagamentos.findOne as unknown as jest.Mock,
  pagamentoCreate: Pagamentos.create as unknown as jest.Mock,
  publish: EventBusService.publish as unknown as jest.Mock,
  aviso: AvisoPedidoService.avisarMudancaDeStatus as unknown as jest.Mock,
};

const comprador = { id_usuario: 7, email: "cliente@agnus.fit" };

const pedido = (extra: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = {
    id_pedido: 42,
    id_usuario: 7,
    status: "aguardando_pagamento",
    valor_total: "149.90",
    valor_frete: null,
    ...extra,
  };
  return { ...dados, update: jest.fn(async (novos: Record<string, unknown>) => Object.assign(dados, novos) && Object.assign(objeto, novos)) } as never;
};
let objeto: Record<string, unknown> = {};

const respostaMP = (extra: Record<string, unknown> = {}) => ({
  id: 9001,
  status: "approved",
  status_detail: "accredited",
  payment_method_id: "visa",
  payment_type_id: "credit_card",
  transaction_amount: 149.9,
  currency_id: "BRL",
  installments: 3,
  external_reference: "42",
  date_of_expiration: null,
  ...extra,
});

const fetchMock = jest.fn();

beforeEach(() => {
  definirConfiguracaoMercadoPago({ accessToken: "TEST-token", publicKey: "TEST-pk", webhookSecret: "s", urlNotificacao: "https://x.test/pagamentos/webhook" });
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  mocks.pagamentoFindOne.mockResolvedValue(null);
  mocks.pagamentoCreate.mockImplementation(async (valores: Record<string, unknown>) => ({ ...valores }));
});

const comPedido = (extra: Record<string, unknown> = {}) => {
  const p = pedido(extra);
  objeto = p as unknown as Record<string, unknown>;
  mocks.pedido.mockResolvedValue(p);
  return p as unknown as Record<string, unknown> & { update: jest.Mock };
};

const cartao = { payment_method_id: "visa", token: "tok_cartao_123456", installments: 3, issuer_id: "25", transaction_amount: 0.01, payer: { email: "comprador@exemplo.com", identification: { type: "CPF", number: "529.982.247-25" } } };

describe("PagamentoService.iniciar", () => {
  it("cobra o total do pedido gravado no banco, não o valor enviado pelo navegador", async () => {
    comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP()), { status: 201 }));

    await PagamentoService.iniciar(42, comprador, cartao);

    const [url, init] = fetchMock.mock.calls[0];
    const corpo = JSON.parse(init.body);
    expect(url).toBe("https://api.mercadopago.com/v1/payments");
    expect(init.headers.Authorization).toBe("Bearer TEST-token");
    expect(init.headers["X-Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(corpo).toMatchObject({
      transaction_amount: 149.9,
      external_reference: "42",
      notification_url: "https://x.test/pagamentos/webhook",
      payment_method_id: "visa",
      token: "tok_cartao_123456",
      installments: 3,
      issuer_id: 25,
      payer: { email: "comprador@exemplo.com", identification: { type: "CPF", number: "52998224725" } },
    });
  });

  it("cartão aprovado marca o pedido como pago, avisa o cliente e publica o evento", async () => {
    const p = comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP()), { status: 201 }));

    const resultado = await PagamentoService.iniciar(42, comprador, cartao);

    expect(p.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pago" }));
    expect(mocks.aviso).toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledWith("pedido.atualizado", expect.objectContaining({ id_pedido: 42, status: "pago" }));
    expect(resultado.pagamento).toMatchObject({ status: "approved", metodo: "visa", parcelas: 3 });
  });

  it("cartão recusado deixa o pedido aguardando pagamento", async () => {
    const p = comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP({ status: "rejected", status_detail: "cc_rejected_insufficient_amount" })), { status: 201 }));

    const resultado = await PagamentoService.iniciar(42, comprador, cartao);

    expect(p.update).not.toHaveBeenCalled();
    expect(resultado.pagamento).toMatchObject({ status: "rejected", status_detalhe: "cc_rejected_insufficient_amount" });
  });

  it("PIX devolve o copia e cola e o QR Code", async () => {
    comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP({
      status: "pending", status_detail: "pending_waiting_transfer", payment_method_id: "pix", payment_type_id: "bank_transfer", installments: 1,
      date_of_expiration: "2099-01-01T00:00:00.000-03:00",
      point_of_interaction: { transaction_data: { qr_code: "00020126...", qr_code_base64: "iVBOR..." } },
    })), { status: 201 }));

    const resultado = await PagamentoService.iniciar(42, comprador, { payment_method_id: "pix", payer: { email: "x@y.com" } });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("token");
    expect(resultado.pagamento?.pix).toMatchObject({ copia_e_cola: "00020126...", qr_code_base64: "iVBOR..." });
  });

  it("reaproveita um PIX ainda válido do mesmo pedido em vez de gerar outra cobrança", async () => {
    comPedido();
    mocks.pagamentoFindOne.mockResolvedValueOnce({
      metodo: "pix", status: "pending", pix_copia_e_cola: "000201...", pix_qr_code_base64: "iV", pix_expira_em: new Date(Date.now() + 3600_000), valor: "142.40",
    });

    const resultado = await PagamentoService.iniciar(42, comprador, { payment_method_id: "pix" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultado.pagamento?.pix?.copia_e_cola).toBe("000201...");
  });

  it("PIX cobra 5% a menos que o total do pedido; o cartão cobra o total", async () => {
    comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP({ status: "pending", payment_method_id: "pix", transaction_amount: 142.4 })), { status: 201 }));

    await PagamentoService.iniciar(42, comprador, { payment_method_id: "pix" });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).transaction_amount).toBe(142.4);
  });

  it("não reaproveita um PIX de valor cheio (gerado antes do desconto): gera outro com o desconto", async () => {
    comPedido();
    mocks.pagamentoFindOne.mockResolvedValueOnce({
      metodo: "pix", status: "pending", pix_copia_e_cola: "antigo", pix_expira_em: new Date(Date.now() + 3600_000), valor: "149.90",
    });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP({ status: "pending", payment_method_id: "pix", transaction_amount: 142.4 })), { status: 201 }));

    await PagamentoService.iniciar(42, comprador, { payment_method_id: "pix" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pedido de outra pessoa responde 404, sem chamar o Mercado Pago", async () => {
    comPedido({ id_usuario: 99 });
    await expect(PagamentoService.iniciar(42, comprador, cartao)).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pedido já pago responde 409", async () => {
    comPedido({ status: "pago" });
    await expect(PagamentoService.iniciar(42, comprador, cartao)).rejects.toMatchObject({ status: 409 });
  });

  it("recusa cartão sem token e parcelas fora do limite", async () => {
    comPedido();
    await expect(PagamentoService.iniciar(42, comprador, { ...cartao, token: "" })).rejects.toMatchObject({ status: 400 });
    await expect(PagamentoService.iniciar(42, comprador, { ...cartao, installments: 24 })).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sem MP_NOTIFICATION_URL não envia notification_url", async () => {
    definirConfiguracaoMercadoPago({ accessToken: "APP_USR-token", publicKey: "APP_USR-pk", webhookSecret: "", urlNotificacao: null });
    comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP()), { status: 201 }));
    await PagamentoService.iniciar(42, comprador, cartao);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("notification_url");
  });

  it("sem configuração responde 503", async () => {
    definirConfiguracaoMercadoPago(null);
    await expect(PagamentoService.iniciar(42, comprador, cartao)).rejects.toMatchObject({ status: 503 });
  });

  it("credencial recusada (401) vira 503, não erro do cliente", async () => {
    comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "Unauthorized use of live credentials", cause: [{ code: 7 }] }), { status: 401 }));
    await expect(PagamentoService.iniciar(42, comprador, cartao)).rejects.toMatchObject({ status: 503 });
  });

  it("erro 4xx do Mercado Pago vira 400 para o cliente", async () => {
    comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ message: "invalid", cause: [{ code: 2067 }] }), { status: 400 }));
    await expect(PagamentoService.iniciar(42, comprador, cartao)).rejects.toMatchObject({ status: 400 });
  });
});

describe("PagamentoService.aplicar", () => {
  it("não marca como pago quando o valor cobrado é diferente do pedido", async () => {
    const p = comPedido();
    await PagamentoService.aplicar(p as never, respostaMP({ transaction_amount: 1 }) as never);
    expect(p.update).not.toHaveBeenCalled();
  });

  it("PIX aprovado com desconto grava o desconto e baixa o total do pedido", async () => {
    const p = comPedido();
    await PagamentoService.aplicar(p as never, respostaMP({ payment_method_id: "pix", transaction_amount: 142.4 }) as never);
    expect(p.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pago", valor_desconto_pix: 7.5, valor_total: 142.4 }));
  });

  it("PIX de valor cheio (antigo) também confirma o pedido, sem desconto", async () => {
    const p = comPedido();
    await PagamentoService.aplicar(p as never, respostaMP({ payment_method_id: "pix", transaction_amount: 149.9 }) as never);
    expect(p.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pago" }));
    expect(p.update.mock.calls[0][0]).not.toHaveProperty("valor_desconto_pix");
  });

  it("cartão com o valor do PIX não confirma o pedido", async () => {
    const p = comPedido();
    await PagamentoService.aplicar(p as never, respostaMP({ transaction_amount: 142.4 }) as never);
    expect(p.update).not.toHaveBeenCalled();
  });

  it("depois do desconto aplicado, a mesma notificação do PIX não desconta de novo", async () => {
    const p = comPedido({ status: "pago", valor_total: "142.40", valor_desconto_pix: "7.50" });
    await PagamentoService.aplicar(p as never, respostaMP({ payment_method_id: "pix", transaction_amount: 142.4 }) as never);
    expect(p.update).not.toHaveBeenCalled();
  });

  it("recusa pagamento de outro pedido", async () => {
    const p = comPedido();
    await expect(PagamentoService.aplicar(p as never, respostaMP({ external_reference: "43" }) as never)).rejects.toMatchObject({ status: 409 });
  });

  it("estorno de pedido pago vira cancelado", async () => {
    const p = comPedido({ status: "pago" });
    await PagamentoService.aplicar(p as never, respostaMP({ status: "refunded" }) as never);
    expect(p.update).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelado" }));
  });
});

describe("PagamentoService.notificar (webhook)", () => {
  it("busca o pagamento na API do Mercado Pago e atualiza o pedido da referência", async () => {
    const p = comPedido();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(respostaMP()), { status: 200 }));

    await PagamentoService.notificar("9001");

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.mercadopago.com/v1/payments/9001");
    expect(mocks.pedido).toHaveBeenCalledWith(42);
    expect(p.update).toHaveBeenCalledWith(expect.objectContaining({ status: "pago" }));
  });
});
