import { consultarShopify } from "../src/shopify/cliente";
import { codificarId } from "../src/shopify/ids";
import { gravarCache, lerCache } from "../src/services/cache";
import { adicionarLinhas, atualizarLinha, buscarSacola, enderecoDoCheckout, vincularSacola } from "../src/services/sacola.service";
import { buscarProduto, limparBusca, listarColecoes, listarProdutos } from "../src/services/vitrine.service";

jest.mock("../src/shopify/cliente", () => ({
  __esModule: true,
  consultarShopify: jest.fn(),
  configuracaoAtual: () => ({ pais: "BR" }),
}));

jest.mock("../src/services/cache", () => ({
  __esModule: true,
  chaveDe: (operacao: string) => operacao,
  comCache: (_chave: string, _ttl: number, carregar: () => Promise<unknown>) => carregar(),
  lerCache: jest.fn(),
  gravarCache: jest.fn(),
  apagarCache: jest.fn(),
}));

const shopify = consultarShopify as jest.Mock;
const dinheiro = (amount: string) => ({ amount, currencyCode: "BRL" });

const sacolaCrua = (id: string, linhas: { variante: string; qtd: number }[] = []) => ({
  id,
  checkoutUrl: `https://agnus.myshopify.com/cart/c/${id.length}`,
  totalQuantity: linhas.reduce((t, l) => t + l.qtd, 0),
  cost: { subtotalAmount: dinheiro("0"), totalAmount: dinheiro("0") },
  lines: {
    nodes: linhas.map((l, i) => ({
      id: `gid://shopify/CartLine/${i}`,
      quantity: l.qtd,
      cost: { amountPerQuantity: dinheiro("10"), totalAmount: dinheiro("10") },
      merchandise: {
        id: l.variante,
        title: "M",
        availableForSale: true,
        selectedOptions: [],
        image: null,
        product: { handle: "regata", title: "Regata", featuredImage: null },
      },
    })),
  },
});

const pagina = { nodes: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } };

describe("vitrine", () => {
  it("limpa a sintaxe de busca do Shopify", () => {
    expect(limparBusca('regata" OR tag:(x)')).toBe("regata or tag x");
    expect(limparBusca(undefined)).toBe("");
  });

  it("ordena pela relevância só quando há busca", async () => {
    shopify.mockResolvedValue({ products: pagina });

    await listarProdutos({ busca: "regata" });
    expect(shopify.mock.calls[0][1]).toMatchObject({ query: "regata", sortKey: "RELEVANCE", first: 12 });

    await listarProdutos({ ordem: "maior", limite: 500 });
    expect(shopify.mock.calls[1][1]).toMatchObject({ sortKey: "PRICE", reverse: true, first: 48 });
  });

  it("volta uma página com last/before", async () => {
    shopify.mockResolvedValue({ products: pagina });
    await listarProdutos({ antes: "abc=" });
    expect(shopify.mock.calls[0][1]).toMatchObject({ last: 12, before: "abc=" });
  });

  it("usa a consulta da coleção e devolve vazio quando ela não existe", async () => {
    shopify.mockResolvedValue({ collection: null });
    await expect(listarProdutos({ colecao: "regatas" })).resolves.toMatchObject({ produtos: [] });
    expect(shopify.mock.calls[0][1]).toMatchObject({ handle: "regatas", sortKey: "COLLECTION_DEFAULT" });
  });

  it("recusa coleção e cursor malformados", async () => {
    await expect(listarProdutos({ colecao: "a b" })).rejects.toMatchObject({ status: 400 });
    await expect(listarProdutos({ depois: "}{" })).rejects.toMatchObject({ status: 400 });
  });

  it("esconde a coleção automática da página inicial do Shopify", async () => {
    shopify.mockResolvedValue({
      collections: { nodes: [{ id: "1", handle: "frontpage", title: "Página inicial" }, { id: "2", handle: "regatas", title: "Regatas" }] },
    });
    await expect(listarColecoes()).resolves.toEqual([{ id: "2", handle: "regatas", nome: "Regatas" }]);
  });

  it("responde 404 para peça inexistente", async () => {
    shopify.mockResolvedValue({ product: null });
    await expect(buscarProduto("nao-existe")).rejects.toMatchObject({ status: 404 });
  });
});

describe("sacola", () => {
  const cartId = "gid://shopify/Cart/c1?key=k";
  const variante = "gid://shopify/ProductVariant/7";

  it("valida a quantidade antes de chamar o Shopify", async () => {
    await expect(adicionarLinhas(codificarId(cartId), [{ variante, quantidade: 0 }])).rejects.toMatchObject({ status: 400 });
    await expect(adicionarLinhas(codificarId(cartId), [])).rejects.toMatchObject({ status: 400 });
    expect(shopify).not.toHaveBeenCalled();
  });

  it("traduz o erro de estoque do Shopify", async () => {
    shopify.mockResolvedValue({ cartLinesAdd: { cart: null, userErrors: [{ field: null, message: "x", code: "MERCHANDISE_OUT_OF_STOCK" }] } });
    await expect(adicionarLinhas(codificarId(cartId), [{ variante }])).rejects.toMatchObject({ status: 422, message: "Esta opção da peça esgotou." });
  });

  it("remove a linha quando a quantidade chega a zero", async () => {
    shopify.mockResolvedValue({ cartLinesRemove: { cart: sacolaCrua(cartId), userErrors: [] } });
    await atualizarLinha(codificarId(cartId), codificarId("gid://shopify/CartLine/1"), 0);
    expect(shopify.mock.calls[0][1]).toEqual({ cartId, lineIds: ["gid://shopify/CartLine/1"] });
  });

  it("liga a sacola do visitante à conta que não tinha outra", async () => {
    (lerCache as jest.Mock).mockResolvedValue(null);
    shopify.mockResolvedValue({ cartBuyerIdentityUpdate: { cart: sacolaCrua(cartId), userErrors: [] } });

    await vincularSacola(codificarId(cartId), { id_usuario: 3, email: "a@b.com" });

    expect(shopify.mock.calls[0][1]).toMatchObject({ cartId, buyerIdentity: { email: "a@b.com", countryCode: "BR" } });
    expect(gravarCache).toHaveBeenCalledWith("sacola:usuario:3", cartId, expect.any(Number));
  });

  it("junta as peças do visitante na sacola que a conta já tinha", async () => {
    const guardadaId = "gid://shopify/Cart/antiga?key=z";
    (lerCache as jest.Mock).mockResolvedValue(guardadaId);
    shopify
      .mockResolvedValueOnce({ cart: sacolaCrua(guardadaId) })
      .mockResolvedValueOnce({ cart: sacolaCrua(cartId, [{ variante, qtd: 2 }]) })
      .mockResolvedValueOnce({ cartLinesAdd: { cart: sacolaCrua(guardadaId, [{ variante, qtd: 2 }]), userErrors: [] } })
      .mockResolvedValueOnce({ cartBuyerIdentityUpdate: { cart: sacolaCrua(guardadaId, [{ variante, qtd: 2 }]), userErrors: [] } });

    const sacola = await vincularSacola(codificarId(cartId), { id_usuario: 3, email: "a@b.com" });

    expect(shopify.mock.calls[2][1]).toEqual({ cartId: guardadaId, lines: [{ merchandiseId: variante, quantity: 2 }] });
    expect(sacola.quantidade).toBe(2);
    expect(gravarCache).toHaveBeenCalledWith("sacola:usuario:3", guardadaId, expect.any(Number));
  });

  const comprador = { id_usuario: 3, email: "a@b.com" };

  const respostasDoCheckout = (sacola: object) => ({
    cartAttributesUpdate: { cart: sacola, userErrors: [] },
    cartBuyerIdentityUpdate: { cart: sacola, userErrors: [] },
  });

  it("não abre checkout de sacola vazia", async () => {
    shopify.mockResolvedValue(respostasDoCheckout(sacolaCrua(cartId)));
    await expect(enderecoDoCheckout(codificarId(cartId), comprador)).rejects.toMatchObject({ status: 409 });
  });

  it("marca a sacola com a conta, identifica o cliente e devolve o endereço do checkout", async () => {
    shopify.mockResolvedValue(respostasDoCheckout(sacolaCrua(cartId, [{ variante, qtd: 1 }])));

    await expect(enderecoDoCheckout(codificarId(cartId), comprador)).resolves.toEqual({ checkoutUrl: expect.stringContaining("myshopify.com") });
    expect(shopify.mock.calls[0][1]).toEqual({ cartId, attributes: [{ key: "_agnus_id_usuario", value: "3" }] });
    expect(shopify.mock.calls[1][1]).toMatchObject({ cartId, buyerIdentity: { email: "a@b.com" } });
  });

  it("não expõe o endereço do checkout na leitura da sacola", async () => {
    shopify.mockResolvedValue({ cart: sacolaCrua(cartId, [{ variante, qtd: 1 }]) });
    await expect(buscarSacola(codificarId(cartId))).resolves.not.toHaveProperty("checkoutUrl");
  });
});
