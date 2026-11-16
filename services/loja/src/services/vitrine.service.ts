import { HttpError } from "@agnus/comum/types/http_error";
import { CACHE_TTL } from "../config";
import { consultarShopify } from "../shopify/cliente";
import {
  BUSCAR_PRODUTO,
  LISTAR_COLECOES,
  LISTAR_PRODUTOS,
  LISTAR_PRODUTOS_DA_COLECAO,
  PRODUTOS_RELACIONADOS,
} from "../shopify/consultas";
import {
  normalizarCartao,
  normalizarColecao,
  normalizarPagina,
  normalizarProduto,
  type ColecaoShopify,
  type ConexaoProdutosShopify,
  type ProdutoCartaoShopify,
  type ProdutoShopify,
} from "../shopify/normalizar";
import { chaveDe, comCache } from "./cache";

export const ORDENS = ["relevancia", "menor", "maior", "novidades", "mais-vendidos"] as const;
export type Ordem = (typeof ORDENS)[number];

export type FiltroVitrine = {
  busca?: string;
  colecao?: string;
  ordem?: Ordem;
  depois?: string;
  antes?: string;
  limite?: number;
};

const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 48;
const MAX_RELACIONADOS = 4;
const HANDLE_VALIDO = /^[\p{L}\p{N}_-]{1,255}$/u;
const CURSOR_VALIDO = /^[A-Za-z0-9+/=_-]{1,512}$/;

export const handleValido = (handle: unknown): handle is string =>
  typeof handle === "string" && HANDLE_VALIDO.test(handle);

// A busca do Shopify tem sintaxe própria ("tag:x", "OR"); o texto do cliente entra só como palavras.
// OR/AND/NOT em maiúsculas são operadores para o Shopify; em minúsculas são só palavras.
export const limparBusca = (texto: unknown) =>
  typeof texto === "string"
    ? texto
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .replace(/\b(OR|AND|NOT)\b/g, (operador) => operador.toLowerCase())
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80)
    : "";

// Poucos tamanhos de página possíveis: cada combinação diferente seria uma consulta nova ao Shopify
// e uma chave a mais no Redis.
const TAMANHOS_DE_PAGINA = [4, 8, 12, 24, 48];
const tamanhoDaPagina = (pedido: number | undefined) => {
  const limite = Math.min(Math.max(Math.trunc(pedido || LIMITE_PADRAO), 1), LIMITE_MAXIMO);
  return TAMANHOS_DE_PAGINA.find((tamanho) => tamanho >= limite) ?? LIMITE_MAXIMO;
};

type Ordenacao = { sortKey: string; reverse: boolean };

const ordenacaoDosProdutos = (ordem: Ordem, temBusca: boolean): Ordenacao => {
  switch (ordem) {
    case "menor": return { sortKey: "PRICE", reverse: false };
    case "maior": return { sortKey: "PRICE", reverse: true };
    case "novidades": return { sortKey: "CREATED_AT", reverse: true };
    case "mais-vendidos": return { sortKey: "BEST_SELLING", reverse: false };
    // RELEVANCE só vale com texto de busca.
    default: return temBusca ? { sortKey: "RELEVANCE", reverse: false } : { sortKey: "BEST_SELLING", reverse: false };
  }
};

const ordenacaoDaColecao = (ordem: Ordem): Ordenacao => {
  switch (ordem) {
    case "menor": return { sortKey: "PRICE", reverse: false };
    case "maior": return { sortKey: "PRICE", reverse: true };
    case "novidades": return { sortKey: "CREATED", reverse: true };
    case "mais-vendidos": return { sortKey: "BEST_SELLING", reverse: false };
    default: return { sortKey: "COLLECTION_DEFAULT", reverse: false };
  }
};

const paginacao = (filtro: FiltroVitrine) => {
  const limite = tamanhoDaPagina(filtro.limite);

  for (const cursor of [filtro.depois, filtro.antes]) {
    if (cursor !== undefined && !CURSOR_VALIDO.test(cursor)) {
      throw new HttpError(400, "Página inválida.");
    }
  }

  return filtro.antes ? { last: limite, before: filtro.antes } : { first: limite, after: filtro.depois };
};

const PAGINA_VAZIA = { produtos: [], paginacao: { temProxima: false, temAnterior: false, inicio: null, fim: null } };

export const listarProdutos = async (filtro: FiltroVitrine) => {
  const busca = limparBusca(filtro.busca);
  const ordem: Ordem = filtro.ordem && ORDENS.includes(filtro.ordem) ? filtro.ordem : "relevancia";
  const pagina = paginacao(filtro);

  if (filtro.colecao !== undefined && !handleValido(filtro.colecao)) {
    throw new HttpError(400, "Coleção inválida.");
  }

  // O Shopify não filtra coleção com texto livre; quem busca procura na loja inteira.
  if (filtro.colecao && !busca) {
    const variaveis = { handle: filtro.colecao, ...pagina, ...ordenacaoDaColecao(ordem) };

    return comCache(chaveDe("colecao-produtos", variaveis), CACHE_TTL.vitrine, async () => {
      const dados = await consultarShopify<{ collection: { products: ConexaoProdutosShopify } | null }>(
        LISTAR_PRODUTOS_DA_COLECAO, variaveis,
      );
      return dados.collection ? normalizarPagina(dados.collection.products) : PAGINA_VAZIA;
    });
  }

  const variaveis = { query: busca || undefined, ...pagina, ...ordenacaoDosProdutos(ordem, Boolean(busca)) };

  return comCache(chaveDe("produtos", variaveis), CACHE_TTL.vitrine, async () => {
    const dados = await consultarShopify<{ products: ConexaoProdutosShopify }>(LISTAR_PRODUTOS, variaveis);
    return normalizarPagina(dados.products);
  });
};

// "frontpage" é a coleção que o Shopify cria sozinho para a página inicial do tema dele; na
// vitrine da Agnus ela só repetiria o filtro "Todas".
const COLECOES_OCULTAS = new Set(["frontpage"]);

export const listarColecoes = () =>
  comCache("colecoes", CACHE_TTL.colecoes, async () => {
    const dados = await consultarShopify<{ collections: { nodes: ColecaoShopify[] } }>(LISTAR_COLECOES);
    return dados.collections.nodes.filter((c) => !COLECOES_OCULTAS.has(c.handle)).map(normalizarColecao);
  });

export const buscarProduto = async (handle: string) => {
  if (!handleValido(handle)) {
    throw new HttpError(400, "Peça inválida.");
  }

  const produto = await comCache(chaveDe("produto", { handle }), CACHE_TTL.produto, async () => {
    const dados = await consultarShopify<{ product: ProdutoShopify | null }>(BUSCAR_PRODUTO, { handle });
    return dados.product ? normalizarProduto(dados.product) : null;
  });

  if (!produto) {
    throw new HttpError(404, "Peça não encontrada.");
  }

  return produto;
};

export const listarRelacionados = async (handle: string) => {
  const produto = await buscarProduto(handle);

  return comCache(chaveDe("relacionados", { handle }), CACHE_TTL.relacionados, async () => {
    const dados = await consultarShopify<{ productRecommendations: ProdutoCartaoShopify[] | null }>(
      PRODUTOS_RELACIONADOS, { productId: produto.id },
    );

    return (dados.productRecommendations ?? [])
      .filter((p) => p.id !== produto.id)
      .slice(0, MAX_RELACIONADOS)
      .map(normalizarCartao);
  });
};
