import { createHmac } from "crypto";
import { assinaturaValida, lerConfiguracaoMercadoPago, statusDoPedido } from "../../src/pagamentos/mercadoPago";

const SEGREDO = "segredo-do-webhook";
const assinar = (manifesto: string) => createHmac("sha256", SEGREDO).update(manifesto).digest("hex");

describe("Mercado Pago: configuração", () => {
  it("fica desligado sem access token ou public key", () => {
    expect(lerConfiguracaoMercadoPago({})).toBeNull();
    expect(lerConfiguracaoMercadoPago({ MP_ACCESS_TOKEN: "TEST-x" })).toBeNull();
  });

  it("aceita as credenciais de teste novas (APP_USR-) e deixa webhook e URL opcionais", () => {
    expect(lerConfiguracaoMercadoPago({ MP_ACCESS_TOKEN: "APP_USR-1234-abc", MP_PUBLIC_KEY: "APP_USR-pk-1" })).toEqual({
      accessToken: "APP_USR-1234-abc",
      publicKey: "APP_USR-pk-1",
      webhookSecret: "",
      urlNotificacao: null,
    });
  });

  it("lê as variáveis MP_*", () => {
    expect(lerConfiguracaoMercadoPago({
      MP_ACCESS_TOKEN: " TEST-token ",
      MP_PUBLIC_KEY: "TEST-pk",
      MP_WEBHOOK_SECRET: "s",
      MP_NOTIFICATION_URL: "https://exemplo.ngrok.app/pagamentos/webhook",
    })).toEqual({
      accessToken: "TEST-token",
      publicKey: "TEST-pk",
      webhookSecret: "s",
      urlNotificacao: "https://exemplo.ngrok.app/pagamentos/webhook",
    });
  });
});

describe("Mercado Pago: status do pedido", () => {
  it.each([
    ["approved", "pago"],
    ["refunded", "cancelado"],
    ["charged_back", "cancelado"],
    ["pending", null],
    ["in_process", null],
    ["rejected", null],
    ["cancelled", null],
  ])("%s -> %s", (status, esperado) => {
    expect(statusDoPedido(status)).toBe(esperado);
  });
});

describe("Mercado Pago: assinatura do webhook", () => {
  const agora = 1_800_000_000_000;
  const ts = String(agora);

  it("aceita a assinatura correta", () => {
    const v1 = assinar(`id:123;request-id:req-1;ts:${ts};`);
    expect(assinaturaValida({ assinatura: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "123" }, SEGREDO, agora)).toBe(true);
  });

  it("usa o id em minúsculas no manifesto", () => {
    const v1 = assinar(`id:abc123;request-id:req-1;ts:${ts};`);
    expect(assinaturaValida({ assinatura: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "ABC123" }, SEGREDO, agora)).toBe(true);
  });

  it("recusa assinatura com outro segredo, outro id ou outro request-id", () => {
    const v1 = assinar(`id:123;request-id:req-1;ts:${ts};`);
    expect(assinaturaValida({ assinatura: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "123" }, "outro", agora)).toBe(false);
    expect(assinaturaValida({ assinatura: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "124" }, SEGREDO, agora)).toBe(false);
    expect(assinaturaValida({ assinatura: `ts=${ts},v1=${v1}`, requestId: "req-2", dataId: "123" }, SEGREDO, agora)).toBe(false);
  });

  it("recusa notificação antiga (reaproveitada)", () => {
    const antigo = String(agora - 60 * 60 * 1000);
    const v1 = assinar(`id:123;request-id:req-1;ts:${antigo};`);
    expect(assinaturaValida({ assinatura: `ts=${antigo},v1=${v1}`, requestId: "req-1", dataId: "123" }, SEGREDO, agora)).toBe(false);
  });

  it("recusa sem segredo configurado, sem cabeçalho ou com formato estranho", () => {
    expect(assinaturaValida({ assinatura: `ts=${ts},v1=aa`, requestId: "r", dataId: "1" }, "", agora)).toBe(false);
    expect(assinaturaValida({ requestId: "r", dataId: "1" }, SEGREDO, agora)).toBe(false);
    expect(assinaturaValida({ assinatura: "lixo", requestId: "r", dataId: "1" }, SEGREDO, agora)).toBe(false);
    expect(assinaturaValida({ assinatura: `ts=${ts},v1=zz`, requestId: "r", dataId: "1" }, SEGREDO, agora)).toBe(false);
  });
});
