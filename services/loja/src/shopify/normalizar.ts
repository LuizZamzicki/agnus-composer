import { codificarId, idNumerico } from "./ids";

// Formas cruas da Storefront API (só os campos que as consultas pedem).
type Dinheiro = { amount: string; currencyCode: string };
type Imagem = { url: string; altText: string | null };
type PaginaInfo = { hasNextPage: boolean; hasPreviousPage: boolean; startCursor: string | null; endCursor: string | null };

export type ProdutoCartaoShopify = {
  id: string;
  handle: string;
  title: string;
  availableForSale: boolean;
  priceRange: { minVariantPrice: Dinheiro };
  compareAtPriceRange?: { minVariantPrice: Dinheiro } | null;
  images: { nodes: Imagem[] };
};

export type ConexaoProdutosShopify = { nodes: ProdutoCartaoShopify[]; pageInfo: PaginaInfo };

export type ProdutoShopify = {
  id: string;
  handle: string;
  title: string;
  description: string;
  availableForSale: boolean;
  options: { name: string; optionValues: { name: string; swatch: { color: string | null } | null }[] }[];
  images: { nodes: Imagem[] };
  variants: {
    nodes: {
      id: string;
      title: string;
      availableForSale: boolean;
      price: Dinheiro;
      compareAtPrice: Dinheiro | null;
      selectedOptions: { name: string; value: string }[];
      image: Imagem | null;
    }[];
  };
};

export type ColecaoShopify = { id: string; handle: string; title: string };

export type SacolaShopify = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Dinheiro; totalAmount: Dinheiro };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      cost: { amountPerQuantity: Dinheiro; totalAmount: Dinheiro };
      merchandise: {
        id: string;
        title: string;
        availableForSale: boolean;
        selectedOptions: { name: string; value: string }[];
        image: Imagem | null;
        product: { handle: string; title: string; featuredImage: Imagem | null };
      };
    }[];
  };
};

const valor = (dinheiro?: Dinheiro | null) => {
  const numero = Number(dinheiro?.amount);
  return Number.isFinite(numero) ? numero : 0;
};

// Preço "de" só aparece quando é maior que o "por"; o Shopify devolve 0 quando não há.
const precoComparado = (preco: number, comparado?: Dinheiro | null) => {
  const numero = valor(comparado);
  return numero > preco ? numero : null;
};

// Variante única do Shopify vem com a opção "Title" = "Default Title"; ela não é escolha do cliente.
const ehOpcaoPadrao = (nome: string, valores: string[]) =>
  nome === "Title" && valores.length === 1 && valores[0] === "Default Title";

export const normalizarCartao = (produto: ProdutoCartaoShopify) => {
  const preco = valor(produto.priceRange.minVariantPrice);

  return {
    id: produto.id,
    idNumerico: idNumerico(produto.id),
    handle: produto.handle,
    nome: produto.title,
    disponivel: produto.availableForSale,
    preco,
    precoComparado: precoComparado(preco, produto.compareAtPriceRange?.minVariantPrice),
    moeda: produto.priceRange.minVariantPrice.currencyCode,
    imagens: produto.images.nodes.map((imagem) => imagem.url),
  };
};

export const normalizarPagina = (conexao: ConexaoProdutosShopify) => ({
  produtos: conexao.nodes.map(normalizarCartao),
  paginacao: {
    temProxima: conexao.pageInfo.hasNextPage,
    temAnterior: conexao.pageInfo.hasPreviousPage,
    inicio: conexao.pageInfo.startCursor,
    fim: conexao.pageInfo.endCursor,
  },
});

export const normalizarProduto = (produto: ProdutoShopify) => {
  const opcoes = produto.options
    .filter((opcao) => !ehOpcaoPadrao(opcao.name, opcao.optionValues.map((v) => v.name)))
    .map((opcao) => ({
      nome: opcao.name,
      valores: opcao.optionValues.map((v) => ({ nome: v.name, cor: v.swatch?.color ?? null })),
    }));
  const nomesOpcoes = new Set(opcoes.map((opcao) => opcao.nome));

  const variantes = produto.variants.nodes.map((variante) => {
    const preco = valor(variante.price);

    return {
      id: variante.id,
      nome: variante.title,
      disponivel: variante.availableForSale,
      preco,
      precoComparado: precoComparado(preco, variante.compareAtPrice),
      opcoes: Object.fromEntries(
        variante.selectedOptions.filter((o) => nomesOpcoes.has(o.name)).map((o) => [o.name, o.value]),
      ),
      imagem: variante.image?.url ?? null,
    };
  });

  const imagens = produto.images.nodes.map((imagem) => ({ url: imagem.url, alt: imagem.altText ?? "" }));
  const precos = variantes.map((v) => v.preco);

  return {
    id: produto.id,
    idNumerico: idNumerico(produto.id),
    handle: produto.handle,
    nome: produto.title,
    descricao: produto.description,
    disponivel: produto.availableForSale,
    preco: precos.length ? Math.min(...precos) : 0,
    moeda: produto.variants.nodes[0]?.price.currencyCode ?? "BRL",
    imagens,
    opcoes,
    variantes,
  };
};

export const normalizarColecao = (colecao: ColecaoShopify) => ({
  id: colecao.id,
  handle: colecao.handle,
  nome: colecao.title,
});

// Sem checkoutUrl: o endereço do pagamento só sai pela rota de checkout, que exige login.
export const normalizarSacola = (sacola: SacolaShopify) => ({
  id: codificarId(sacola.id),
  quantidade: sacola.totalQuantity,
  subtotal: valor(sacola.cost.subtotalAmount),
  total: valor(sacola.cost.totalAmount),
  moeda: sacola.cost.totalAmount.currencyCode,
  linhas: sacola.lines.nodes
    // Linha sem variante: peça apagada no Shopify depois de entrar na sacola.
    .filter((linha) => linha.merchandise?.id)
    .map((linha) => {
      const variante = linha.merchandise;

      return {
        id: codificarId(linha.id),
        quantidade: linha.quantity,
        precoUnitario: valor(linha.cost.amountPerQuantity),
        total: valor(linha.cost.totalAmount),
        varianteId: variante.id,
        disponivel: variante.availableForSale,
        opcoes: variante.selectedOptions
          .filter((o) => !(o.name === "Title" && o.value === "Default Title"))
          .map((o) => ({ nome: o.name, valor: o.value })),
        produto: { handle: variante.product.handle, nome: variante.product.title },
        imagem: variante.image?.url ?? variante.product.featuredImage?.url ?? null,
      };
    }),
});

export type Sacola = ReturnType<typeof normalizarSacola>;
export type ProdutoDetalhe = ReturnType<typeof normalizarProduto>;
