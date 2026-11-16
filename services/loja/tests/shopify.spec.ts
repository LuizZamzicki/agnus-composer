import { lerConfiguracao, normalizarDominio } from "../src/config";
import { consultarShopify, definirConfiguracao } from "../src/shopify/cliente";
import { codificarId, decodificarId, idNumerico } from "../src/shopify/ids";
import { normalizarProduto, normalizarSacola, type ProdutoShopify, type SacolaShopify } from "../src/shopify/normalizar";

describe("configuração", () => {
  it("prefere o token privado e monta o endpoint da versão", () => {
    const config = lerConfiguracao({
      SHOPIFY_STORE_DOMAIN: "https://Agnus.myshopify.com/",
      SHOPIFY_STOREFRONT_PRIVATE_TOKEN: "shpat_x",
      SHOPIFY_STOREFRONT_PUBLIC_TOKEN: "pub",
      SHOPIFY_API_VERSION: "2026-04",
    });

    expect(config?.endpoint).toBe("https://agnus.myshopify.com/api/2026-04/graphql.json");
    expect(config?.cabecalhos).toEqual({ "Shopify-Storefront-Private-Token": "shpat_x" });
    expect(config?.pais).toBe("BR");
  });

  it("aceita só o token público", () => {
    const config = lerConfiguracao({ SHOPIFY_STORE_DOMAIN: "agnus.myshopify.com", SHOPIFY_STOREFRONT_PUBLIC_TOKEN: "pub" });
    expect(config?.cabecalhos).toEqual({ "X-Shopify-Storefront-Access-Token": "pub" });
    expect(config?.tokenPrivado).toBe(false);
  });

  it("fica desligada sem domínio ou token", () => {
    expect(lerConfiguracao({ SHOPIFY_STORE_DOMAIN: "agnus.myshopify.com" })).toBeNull();
    expect(lerConfiguracao({ SHOPIFY_STOREFRONT_PUBLIC_TOKEN: "pub" })).toBeNull();
    expect(normalizarDominio(" loja.com.br/x ")).toBe("loja.com.br");
  });
});

describe("ids", () => {
  it("leva o id da sacola em base64url e volta igual", () => {
    const gid = "gid://shopify/Cart/c1-abc?key=segredo";
    expect(decodificarId(codificarId(gid), "Cart")).toBe(gid);
    expect(codificarId(gid)).not.toMatch(/[/?=+]/);
  });

  it("recusa id de outro tipo ou malformado", () => {
    expect(() => decodificarId(codificarId("gid://shopify/Customer/1"), "Cart")).toThrow("Identificador inválido.");
    expect(() => decodificarId("", "Cart")).toThrow();
    expect(() => decodificarId(42, "Cart")).toThrow();
  });

  it("aceita a variante no formato original", () => {
    expect(decodificarId("gid://shopify/ProductVariant/9", "ProductVariant")).toBe("gid://shopify/ProductVariant/9");
  });

  it("extrai o número do produto", () => {
    expect(idNumerico("gid://shopify/Product/8907384062234")).toBe("8907384062234");
  });
});

describe("normalização", () => {
  const dinheiro = (amount: string) => ({ amount, currencyCode: "BRL" });

  it("esconde a opção padrão de produto sem variações", () => {
    const produto: ProdutoShopify = {
      id: "gid://shopify/Product/1",
      handle: "terco",
      title: "Terço",
      description: "",
      availableForSale: true,
      options: [{ name: "Title", optionValues: [{ name: "Default Title", swatch: null }] }],
      images: { nodes: [] },
      variants: {
        nodes: [{
          id: "gid://shopify/ProductVariant/1",
          title: "Default Title",
          availableForSale: true,
          price: dinheiro("50.0"),
          compareAtPrice: dinheiro("0.0"),
          selectedOptions: [{ name: "Title", value: "Default Title" }],
          image: null,
        }],
      },
    };

    const normalizado = normalizarProduto(produto);

    expect(normalizado.opcoes).toEqual([]);
    expect(normalizado.variantes[0]).toMatchObject({ opcoes: {}, preco: 50, precoComparado: null });
    expect(normalizado.idNumerico).toBe("1");
  });

  it("converte a sacola e codifica os ids", () => {
    const sacola: SacolaShopify = {
      id: "gid://shopify/Cart/abc?key=k",
      checkoutUrl: "https://agnus.myshopify.com/cart/c/abc",
      totalQuantity: 2,
      cost: { subtotalAmount: dinheiro("200.0"), totalAmount: dinheiro("200.0") },
      lines: {
        nodes: [{
          id: "gid://shopify/CartLine/l1?cart=abc",
          quantity: 2,
          cost: { amountPerQuantity: dinheiro("100.0"), totalAmount: dinheiro("200.0") },
          merchandise: {
            id: "gid://shopify/ProductVariant/7",
            title: "M / Preto",
            availableForSale: true,
            selectedOptions: [{ name: "Tamanho", value: "M" }, { name: "Cor", value: "Preto" }],
            image: null,
            product: { handle: "regata", title: "Regata", featuredImage: { url: "https://cdn.shopify.com/r.jpg", altText: null } },
          },
        }],
      },
    };

    const normalizada = normalizarSacola(sacola);

    expect(decodificarId(normalizada.id, "Cart")).toBe(sacola.id);
    expect(normalizada.linhas[0]).toMatchObject({
      quantidade: 2,
      precoUnitario: 100,
      imagem: "https://cdn.shopify.com/r.jpg",
      opcoes: [{ nome: "Tamanho", valor: "M" }, { nome: "Cor", valor: "Preto" }],
    });
  });
});

describe("cliente GraphQL", () => {
  const fetchOriginal = global.fetch;

  beforeEach(() => {
    definirConfiguracao({
      endpoint: "https://agnus.myshopify.com/api/2026-07/graphql.json",
      cabecalhos: { "Shopify-Storefront-Private-Token": "t" },
      tokenPrivado: true,
      pais: "BR",
      idioma: "PT_BR",
    });
  });

  afterEach(() => {
    global.fetch = fetchOriginal;
    definirConfiguracao(undefined);
  });

  const responder = (status: number, corpo: object) =>
    jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => corpo });

  it("envia token, IP do comprador e o contexto do mercado", async () => {
    const fetchMock = responder(200, { data: { shop: { name: "Agnus" } } });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(consultarShopify("{ shop { name } }", { x: 1 }, { ipComprador: "1.2.3.4" })).resolves.toEqual({ shop: { name: "Agnus" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({ "Shopify-Storefront-Private-Token": "t", "Shopify-Storefront-Buyer-IP": "1.2.3.4" });
    expect(JSON.parse(init.body).variables).toEqual({ pais: "BR", idioma: "PT_BR", x: 1 });
  });

  it("traduz limite de requisições em 503", async () => {
    global.fetch = responder(200, { errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }] }) as unknown as typeof fetch;
    await expect(consultarShopify("{ shop { name } }")).rejects.toMatchObject({ status: 503 });
  });

  it("não expõe token inválido ao cliente", async () => {
    global.fetch = responder(401, { errors: [{ message: "Unauthorized" }] }) as unknown as typeof fetch;
    await expect(consultarShopify("{ shop { name } }")).rejects.toMatchObject({ status: 503, message: expect.stringContaining("indisponível") });
  });

  it("responde 503 quando a loja não foi configurada", async () => {
    definirConfiguracao(null);
    await expect(consultarShopify("{ shop { name } }")).rejects.toMatchObject({ status: 503 });
  });
});
