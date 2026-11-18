import { createHmac } from "crypto";
import { chamarYouDraw, configuracaoYouDraw, criarPedidoYouDraw, ErroYouDraw, webhookYouDrawValido } from "../../src/utils/youdraw";

jest.mock("../../src/utils/logger", () => ({ __esModule: true, default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const AMBIENTE = { ...process.env };
const fetchMock = jest.fn();

beforeEach(() => {
  process.env = { ...AMBIENTE, YOUDRAW_API_KEY: "yd_live_chaveDeTeste123", YOUDRAW_WEBHOOK_SECRET: "whsec_segredo" };
  delete process.env.YOUDRAW_API_URL;
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterAll(() => {
  process.env = AMBIENTE;
});

const resposta = (status: number, corpo: unknown, headers: Record<string, string> = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => corpo, headers: { get: (k: string) => headers[k.toLowerCase()] ?? null } }) as unknown as Response;

describe("configuracaoYouDraw", () => {
  it("liga só com chave yd_live_/yd_test_ e identifica o ambiente", () => {
    expect(configuracaoYouDraw()).toMatchObject({ ambiente: "live", url: "https://api.youdraw.com.br/api/v1", segredoWebhook: "whsec_segredo" });
    expect(configuracaoYouDraw({ YOUDRAW_API_KEY: "yd_test_abcdefgh123" } as NodeJS.ProcessEnv)?.ambiente).toBe("test");
    expect(configuracaoYouDraw({ YOUDRAW_API_KEY: "" } as NodeJS.ProcessEnv)).toBeNull();
    expect(configuracaoYouDraw({ YOUDRAW_API_KEY: "qualquer-coisa" } as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("chamarYouDraw", () => {
  it("cria o pedido com Bearer, Idempotency-Key e devolve o data", async () => {
    fetchMock.mockResolvedValue(resposta(201, { data: { id: "ord_1", public_code: "YD-ABC23", status: "pending_payment" } }));
    const pedido = await criarPedidoYouDraw({ customer: { name: "Ana", document: "12345678909", address: {} as never }, items: [{ sku: "SKU-1", quantity: 1 }] }, "chave-1");

    expect(pedido.public_code).toBe("YD-ABC23");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.youdraw.com.br/api/v1/orders");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ Authorization: "Bearer yd_live_chaveDeTeste123", "Idempotency-Key": "chave-1", Accept: "application/json" });
  });

  it("transforma o erro da YouDraw e diz se vale repetir (doc: 429/5xx sim, 422 não)", async () => {
    fetchMock.mockResolvedValueOnce(resposta(422, { error: { code: "validation_error", message: "SKU inválido", request_id: "req-9" } }));
    const e422 = await chamarYouDraw("/orders", { metodo: "POST", corpo: {} }).catch((e) => e);
    expect(e422).toBeInstanceOf(ErroYouDraw);
    expect(e422).toMatchObject({ status: 422, codigo: "validation_error", requestId: "req-9", retentavel: false });

    fetchMock.mockResolvedValueOnce(resposta(429, { error: { code: "rate_limited", message: "devagar" } }));
    expect(await chamarYouDraw("/orders").catch((e) => e)).toMatchObject({ retentavel: true });

    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));
    expect(await chamarYouDraw("/orders").catch((e) => e)).toMatchObject({ status: 0, codigo: "sem_resposta", retentavel: true });
  });

  it("sem chave não chama nada", async () => {
    delete process.env.YOUDRAW_API_KEY;
    await expect(chamarYouDraw("/orders")).rejects.toMatchObject({ codigo: "nao_configurado" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("webhookYouDrawValido", () => {
  const corpo = Buffer.from('{"id":"e1","type":"order.status_changed"}');
  const assinar = (ts: number, conteudo = corpo, segredo = "whsec_segredo") =>
    `v1=${createHmac("sha256", segredo).update(Buffer.concat([Buffer.from(`${ts}.`), conteudo])).digest("hex")}`;

  it("aceita assinatura correta dentro de 5 minutos", () => {
    const agora = 1_800_000_000;
    expect(webhookYouDrawValido(corpo, String(agora), assinar(agora), "whsec_segredo", agora + 60)).toBe(true);
  });

  it("recusa corpo alterado, segredo errado, cabeçalho malformado e mensagem velha", () => {
    const agora = 1_800_000_000;
    expect(webhookYouDrawValido(Buffer.from('{"id":"e2"}'), String(agora), assinar(agora), "whsec_segredo", agora)).toBe(false);
    expect(webhookYouDrawValido(corpo, String(agora), assinar(agora, corpo, "outro"), "whsec_segredo", agora)).toBe(false);
    expect(webhookYouDrawValido(corpo, String(agora), "abc", "whsec_segredo", agora)).toBe(false);
    expect(webhookYouDrawValido(corpo, String(agora), assinar(agora), "whsec_segredo", agora + 301)).toBe(false);
    expect(webhookYouDrawValido(corpo, undefined, assinar(agora), "whsec_segredo", agora)).toBe(false);
  });
});
