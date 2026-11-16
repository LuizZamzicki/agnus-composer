import { createHmac } from "crypto";
import express from "express";
import request from "supertest";
import YouDrawService from "../../src/fornecedor/youdraw.service";
import router from "../../src/fornecedor/youdraw.routes";

jest.mock("@agnus/comum/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("../../src/fornecedor/youdraw.service", () => ({
  __esModule: true,
  default: { aplicarEvento: jest.fn().mockResolvedValue({ aplicado: true, id_pedido: 21 }), ativa: jest.fn(), resumo: jest.fn() },
  PedidosFornecedor: { findByPk: jest.fn() },
}));

const AMBIENTE = { ...process.env };
const aplicar = YouDrawService.aplicarEvento as jest.Mock;

// Mesmo parser do criarApp: guarda o corpo bruto para conferir a assinatura.
const app = express();
app.use(express.json({ verify: (req, _res, buf) => ((req as unknown as { rawBody: Buffer }).rawBody = buf) }));
app.use(router);

const corpo = JSON.stringify({ id: "e1", type: "order.status_changed", created_at: "2026-11-16T12:00:00Z", data: { object: "order", order: { id: "ord_1", external_reference: "agnus-21", status: "shipped" } } });
const assinar = (ts: number, conteudo = corpo) => `v1=${createHmac("sha256", "whsec_segredo").update(`${ts}.${conteudo}`).digest("hex")}`;
const enviar = (headers: Record<string, string>, conteudo = corpo) =>
  request(app).post("/youdraw/webhook").set("Content-Type", "application/json").set(headers).send(conteudo);

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...AMBIENTE, YOUDRAW_API_KEY: "yd_live_chaveDeTeste123", YOUDRAW_WEBHOOK_SECRET: "whsec_segredo" };
});

afterAll(() => {
  process.env = AMBIENTE;
});

describe("POST /youdraw/webhook", () => {
  it("assinatura válida: aplica o evento", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const r = await enviar({ "X-YouDraw-Timestamp": String(ts), "X-YouDraw-Signature": assinar(ts), "X-YouDraw-Delivery": "d-1", "X-YouDraw-Event": "order.status_changed" });
    expect(r.status).toBe(200);
    expect(aplicar).toHaveBeenCalledWith(expect.objectContaining({ type: "order.status_changed" }));
  });

  it("mesma entrega repetida (retentativa da YouDraw) não aplica duas vezes", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const cabecalhos = { "X-YouDraw-Timestamp": String(ts), "X-YouDraw-Signature": assinar(ts), "X-YouDraw-Delivery": "d-repetida" };
    await enviar(cabecalhos);
    const segunda = await enviar(cabecalhos);
    expect(segunda.body).toMatchObject({ repetido: true });
    expect(aplicar).toHaveBeenCalledTimes(1);
  });

  it("assinatura errada ou corpo adulterado: 401 e nada aplicado", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const r = await enviar({ "X-YouDraw-Timestamp": String(ts), "X-YouDraw-Signature": assinar(ts) }, corpo.replace("shipped", "delivered"));
    expect(r.status).toBe(401);
    expect(aplicar).not.toHaveBeenCalled();
  });

  it("sem segredo configurado: responde 200 sem processar (não confia no corpo)", async () => {
    delete process.env.YOUDRAW_WEBHOOK_SECRET;
    const r = await enviar({});
    expect(r.body).toMatchObject({ processado: false });
    expect(aplicar).not.toHaveBeenCalled();
  });

  it("falha ao aplicar: 500 para a YouDraw tentar de novo", async () => {
    aplicar.mockRejectedValueOnce(new Error("banco fora"));
    const ts = Math.floor(Date.now() / 1000);
    const r = await enviar({ "X-YouDraw-Timestamp": String(ts), "X-YouDraw-Signature": assinar(ts), "X-YouDraw-Delivery": "d-falha" });
    expect(r.status).toBe(500);
  });
});
