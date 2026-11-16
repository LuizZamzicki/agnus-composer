import { consultarAdmin, definirConfiguracaoAdmin } from "../src/shopify/admin";
import { normalizarPedido, pedidoDoCliente, statusDoPedido, type PedidoShopify } from "../src/shopify/pedidos";
import { listarPedidos } from "../src/services/pedidos.service";
import { lerConfiguracaoAdmin } from "../src/config";
import { consultarOuNull } from "@agnus/comum/utils/clienteInterno";

jest.mock("@agnus/comum/utils/clienteInterno", () => ({
  __esModule: true,
  consultarOuNull: jest.fn(async () => ({ email_verificado: false })),
}));
jest.mock("../src/services/cache", () => ({
  __esModule: true,
  comCache: (_chave: string, _ttl: number, carregar: () => Promise<unknown>) => carregar(),
}));

const dinheiro = (amount: string) => ({ shopMoney: { amount, currencyCode: "BRL" } });

const pedido = (extra: Partial<PedidoShopify> = {}): PedidoShopify => ({
  id: "gid://shopify/Order/1",
  name: "#1001",
  email: "cliente@agnus.fit",
  createdAt: "2026-11-11T20:00:00Z",
  cancelledAt: null,
  displayFinancialStatus: "PAID",
  displayFulfillmentStatus: "UNFULFILLED",
  statusPageUrl: "https://agnusfit.myshopify.com/orders/abc",
  currentTotalPriceSet: dinheiro("15.0"),
  totalShippingPriceSet: dinheiro("10.0"),
  customAttributes: [{ key: "_agnus_id_usuario", value: "7" }],
  fulfillments: [],
  lineItems: {
    nodes: [{
      id: "gid://shopify/LineItem/1",
      title: "Camiseta Dry Fit",
      variantTitle: "Black / Regular",
      quantity: 1,
      image: { url: "https://cdn.shopify.com/c.png" },
      discountedTotalSet: dinheiro("5.0"),
      product: { handle: "camiseta" },
    }],
  },
  ...extra,
});

describe("status do pedido do Shopify", () => {
  it.each([
    [{}, "pago"],
    [{ displayFinancialStatus: "PENDING" }, "aguardando_pagamento"],
    [{ cancelledAt: "2026-11-12T00:00:00Z" }, "cancelado"],
    [{ displayFinancialStatus: "REFUNDED" }, "cancelado"],
    [{ displayFulfillmentStatus: "FULFILLED", fulfillments: [{ displayStatus: "IN_TRANSIT", trackingInfo: [] }] }, "enviado"],
    [{ displayFulfillmentStatus: "FULFILLED", fulfillments: [{ displayStatus: "DELIVERED", trackingInfo: [] }] }, "entregue"],
  ] as [Partial<PedidoShopify>, string][])("%o -> %s", (extra, status) => {
    expect(statusDoPedido(pedido(extra))).toBe(status);
  });
});

describe("pedido do cliente", () => {
  const dono = (extra: Partial<{ idUsuario: number; email: string; emailVerificado: boolean }> = {}) => ({
    idUsuario: 7, email: "cliente@agnus.fit", emailVerificado: false, ...extra,
  });

  it("vale o id da conta quando o pedido tem o atributo", () => {
    expect(pedidoDoCliente(pedido(), dono())).toBe(true);
    expect(pedidoDoCliente(pedido(), dono({ idUsuario: 8 }))).toBe(false);
  });

  it("pedido com a marca de outra conta não aparece nem com o mesmo e-mail comprovado", () => {
    expect(pedidoDoCliente(pedido(), dono({ idUsuario: 8, emailVerificado: true }))).toBe(false);
  });

  it("pedido sem marca não aparece só pelo e-mail de um cadastro com senha", () => {
    expect(pedidoDoCliente(pedido({ customAttributes: [] }), dono())).toBe(false);
  });

  it("pedido sem marca aparece quando o e-mail é idêntico e comprovado (login com Google)", () => {
    expect(pedidoDoCliente(pedido({ customAttributes: [], email: "Cliente@Agnus.fit " }), dono({ emailVerificado: true }))).toBe(true);
    expect(pedidoDoCliente(pedido({ customAttributes: [], email: "cliente+x@agnus.fit" }), dono({ emailVerificado: true }))).toBe(false);
    expect(pedidoDoCliente(pedido({ customAttributes: [], email: null }), dono({ emailVerificado: true }))).toBe(false);
  });

  it("normaliza peças, rastreio e total", () => {
    const normalizado = normalizarPedido(pedido({
      fulfillments: [{ displayStatus: "IN_TRANSIT", trackingInfo: [{ number: "BR123", url: "https://rastreio/BR123", company: "Correios" }] }],
    }));

    expect(normalizado).toMatchObject({
      numero: "#1001",
      total: 15,
      frete: 10,
      rastreio: { codigo: "BR123", empresa: "Correios" },
      itens: [{ nome: "Camiseta Dry Fit", opcoes: "Black / Regular", total: 5, handle: "camiseta" }],
    });
  });
});

describe("Admin API", () => {
  const fetchOriginal = global.fetch;

  afterEach(() => {
    global.fetch = fetchOriginal;
    definirConfiguracaoAdmin(undefined);
  });

  const resposta = (status: number, corpo: object) => ({ ok: status < 400, status, json: async () => corpo });

  it("lê a configuração com client id + secret ou token fixo", () => {
    expect(lerConfiguracaoAdmin({ SHOPIFY_STORE_DOMAIN: "agnusfit.myshopify.com", SHOPIFY_ADMIN_CLIENT_ID: "id" })).toBeNull();
    expect(lerConfiguracaoAdmin({ SHOPIFY_STORE_DOMAIN: "agnusfit.myshopify.com", SHOPIFY_ADMIN_TOKEN: "shpat" })?.endpoint)
      .toBe("https://agnusfit.myshopify.com/admin/api/2026-10/graphql.json");
  });

  it("aceita os nomes SHOPIFY_CLIENT_ID e SHOPIFY_CLIENT_SECRET e domínio com https e barra", () => {
    const config = lerConfiguracaoAdmin({
      SHOPIFY_STORE_DOMAIN: "https://agnusfit.myshopify.com/",
      SHOPIFY_CLIENT_ID: "id",
      SHOPIFY_CLIENT_SECRET: "segredo",
    });
    expect(config).toMatchObject({
      clientId: "id",
      clientSecret: "segredo",
      urlDoToken: "https://agnusfit.myshopify.com/admin/oauth/access_token",
      endpoint: "https://agnusfit.myshopify.com/admin/api/2026-10/graphql.json",
    });
  });

  it("troca client id + secret por token e reaproveita o token", async () => {
    definirConfiguracaoAdmin(lerConfiguracaoAdmin({
      SHOPIFY_STORE_DOMAIN: "agnusfit.myshopify.com",
      SHOPIFY_ADMIN_CLIENT_ID: "id",
      SHOPIFY_ADMIN_CLIENT_SECRET: "segredo",
    }));
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(resposta(200, { access_token: "tok", expires_in: 86399 }))
      .mockResolvedValue(resposta(200, { data: { ok: true } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    await consultarAdmin("{ shop { id } }");
    await consultarAdmin("{ shop { id } }");

    // 1 token (só uma vez) + 1 diagnóstico de escopos + 2 consultas.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toBe("https://agnusfit.myshopify.com/admin/oauth/access_token");
    expect(String(fetchMock.mock.calls[0][1].body)).toContain("grant_type=client_credentials");

    const chamadasGraphQL = fetchMock.mock.calls.slice(1);
    expect(chamadasGraphQL.some(([, init]) => String(init.body).includes("currentAppInstallation"))).toBe(true);
    for (const [, init] of chamadasGraphQL) {
      expect(init.headers["X-Shopify-Access-Token"]).toBe("tok");
      // A chave secreta só vai na troca pelo token, nunca nas consultas.
      expect(JSON.stringify(init)).not.toContain("segredo");
    }
  });

  it("responde 503 sem configuração ou com escopo faltando", async () => {
    definirConfiguracaoAdmin(null);
    await expect(consultarAdmin("{}")).rejects.toMatchObject({ status: 503 });

    definirConfiguracaoAdmin(lerConfiguracaoAdmin({ SHOPIFY_STORE_DOMAIN: "a.myshopify.com", SHOPIFY_ADMIN_TOKEN: "t" }));
    global.fetch = jest.fn().mockResolvedValue(
      resposta(200, { errors: [{ message: "x", extensions: { code: "ACCESS_DENIED" } }] }),
    ) as unknown as typeof fetch;
    await expect(consultarAdmin("{}")).rejects.toMatchObject({ status: 503 });
  });

  it("lista só os pedidos da conta, buscando pelo e-mail", async () => {
    definirConfiguracaoAdmin(lerConfiguracaoAdmin({ SHOPIFY_STORE_DOMAIN: "a.myshopify.com", SHOPIFY_ADMIN_TOKEN: "t" }));
    const outraConta = pedido({ id: "gid://shopify/Order/2", customAttributes: [{ key: "_agnus_id_usuario", value: "99" }] });
    const fetchMock = jest.fn().mockResolvedValue(resposta(200, { data: { orders: { nodes: [pedido(), outraConta] } } }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const pedidos = await listarPedidos({ id_usuario: 7, email: "cliente\"@agnus.fit" });

    expect(pedidos.map((p) => p.id)).toEqual(["gid://shopify/Order/1"]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).variables).toEqual({ busca: "email:\"cliente@agnus.fit\"" });
  });

  it("com e-mail comprovado, inclui as compras antigas sem marca feitas com o mesmo e-mail", async () => {
    definirConfiguracaoAdmin(lerConfiguracaoAdmin({ SHOPIFY_STORE_DOMAIN: "a.myshopify.com", SHOPIFY_ADMIN_TOKEN: "t" }));
    (consultarOuNull as jest.Mock).mockResolvedValueOnce({ email_verificado: true });
    const antigo = pedido({ id: "gid://shopify/Order/3", customAttributes: [] });
    global.fetch = jest.fn().mockResolvedValue(resposta(200, { data: { orders: { nodes: [pedido(), antigo] } } })) as unknown as typeof fetch;

    const pedidos = await listarPedidos({ id_usuario: 7, email: "cliente@agnus.fit" });

    expect(consultarOuNull).toHaveBeenCalledWith("identidade", "/usuarios/7");
    expect(pedidos.map((p) => p.id)).toEqual(["gid://shopify/Order/1", "gid://shopify/Order/3"]);
  });
});
