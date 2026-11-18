import { createHmac } from "crypto";
import express from "express";
import request from "supertest";
import { errorHandler } from "@agnus/comum/middlewares/error.middleware";
import { definirConfiguracaoMercadoPago } from "../../src/pagamentos/mercadoPago";
import rotas from "../../src/pagamentos/pagamento.routes";
import PagamentoService from "../../src/pagamentos/pagamento.service";

jest.mock("../../src/pagamentos/pagamento.service", () => ({
  __esModule: true,
  default: { notificar: jest.fn(), configuracaoPublica: jest.fn(() => ({ ativo: true, publicKey: "TEST-pk" })) },
}));

const notificar = PagamentoService.notificar as unknown as jest.Mock;
const SEGREDO = "segredo-do-webhook";
const app = express().use(express.json()).use(rotas).use(errorHandler);

const assinado = (dataId: string, requestId = "req-1") => {
  const ts = String(Date.now());
  const v1 = createHmac("sha256", SEGREDO).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
  return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId };
};

describe("rotas de pagamento", () => {
  beforeEach(() => {
    definirConfiguracaoMercadoPago({ accessToken: "TEST-token", publicKey: "TEST-pk", webhookSecret: SEGREDO, urlNotificacao: null });
  });

  it("GET /pagamentos/config devolve só a chave pública", async () => {
    const resposta = await request(app).get("/pagamentos/config");
    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual({ ativo: true, publicKey: "TEST-pk" });
  });

  it("pagar e consultar um pedido exigem login", async () => {
    expect((await request(app).post("/orders/1/pagamento").send({})).status).toBe(401);
    expect((await request(app).get("/orders/1/pagamento")).status).toBe(401);
  });

  it("webhook com assinatura válida consulta o pagamento", async () => {
    const resposta = await request(app)
      .post("/pagamentos/webhook?data.id=9001&type=payment")
      .set(assinado("9001"))
      .send({ type: "payment", data: { id: "9001" } });

    expect(resposta.status).toBe(200);
    expect(notificar).toHaveBeenCalledWith("9001");
  });

  it("webhook sem assinatura ou com assinatura falsa é recusado", async () => {
    expect((await request(app).post("/pagamentos/webhook?data.id=9001&type=payment").send({})).status).toBe(401);
    const falsa = { "x-signature": `ts=${Date.now()},v1=${"0".repeat(64)}`, "x-request-id": "req-1" };
    expect((await request(app).post("/pagamentos/webhook?data.id=9001&type=payment").set(falsa).send({})).status).toBe(401);
    expect(notificar).not.toHaveBeenCalled();
  });

  it("webhook com assinatura de outro pagamento é recusado", async () => {
    const resposta = await request(app).post("/pagamentos/webhook?data.id=9002&type=payment").set(assinado("9001")).send({});
    expect(resposta.status).toBe(401);
  });

  it("sem a chave secreta configurada, o webhook responde 200 mas não processa nada", async () => {
    definirConfiguracaoMercadoPago({ accessToken: "APP_USR-token", publicKey: "APP_USR-pk", webhookSecret: "", urlNotificacao: null });
    const resposta = await request(app).post("/pagamentos/webhook?data.id=9001&type=payment").set(assinado("9001")).send({});
    expect(resposta.status).toBe(200);
    expect(resposta.body).toMatchObject({ processado: false });
    expect(notificar).not.toHaveBeenCalled();
  });

  it("sem o Mercado Pago configurado, o webhook também não quebra", async () => {
    definirConfiguracaoMercadoPago(null);
    const resposta = await request(app).post("/pagamentos/webhook").send({ type: "payment", data: { id: "1" } });
    expect(resposta.status).toBe(200);
    expect(notificar).not.toHaveBeenCalled();
  });

  it("notificação de outro tipo é confirmada sem consulta", async () => {
    const resposta = await request(app).post("/pagamentos/webhook?data.id=55&type=merchant_order").set(assinado("55")).send({});
    expect(resposta.status).toBe(200);
    expect(notificar).not.toHaveBeenCalled();
  });

  it("falha ao consultar responde 500 para o Mercado Pago tentar de novo", async () => {
    notificar.mockRejectedValueOnce(new Error("fora do ar"));
    const resposta = await request(app).post("/pagamentos/webhook?data.id=9001&type=payment").set(assinado("9001")).send({});
    expect(resposta.status).toBe(500);
  });
});
