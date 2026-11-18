import { chamarServico } from "@agnus/comum/utils/clienteInterno";

export type ProdutoDoCatalogo = {
  id_produto: number;
  id_categoria: number | null;
  nome: string;
  preco_base: number;
  preco_original: number | null;
  ativo: boolean;
  categoria_nome: string | null;
  imagens: string[];
};

type LinhaDoCatalogo = {
  id_produto: number | string;
  id_categoria: number | string | null;
  nome: string;
  preco_base: number | string;
  preco_original?: number | string | null;
  ativo: boolean | number;
  categoria_nome: string | null;
  imagens_json?: string | null;
};

const VALIDADE_MS = 5 * 60 * 1000;
let cache: { produtos: ProdutoDoCatalogo[]; expiraEm: number } | null = null;

const imagens = (json?: string | null) => {
  try {
    const lista = JSON.parse(json ?? "[]");
    return Array.isArray(lista) ? lista.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const normalizar = (linha: LinhaDoCatalogo): ProdutoDoCatalogo => ({
  id_produto: Number(linha.id_produto),
  id_categoria: linha.id_categoria == null ? null : Number(linha.id_categoria),
  nome: linha.nome,
  preco_base: Number(linha.preco_base),
  preco_original: linha.preco_original == null ? null : Number(linha.preco_original),
  ativo: Boolean(linha.ativo),
  categoria_nome: linha.categoria_nome ?? null,
  imagens: imagens(linha.imagens_json),
});

export const limparCacheDoCatalogo = () => {
  cache = null;
};

// Mesma rota interna que alimenta o índice de busca. Cache de 5 min: a vitrine de ofertas não
// precisa do preço ao segundo, e cada conversão também consulta aqui.
export const produtosDoCatalogo = async () => {
  if (cache && cache.expiraEm > Date.now()) {
    return cache.produtos;
  }

  const { data } = await chamarServico<LinhaDoCatalogo[]>("catalogo", "/produtos/documentos", {
    timeoutMs: 10000,
    repetivel: true,
  });
  const produtos = data.map(normalizar);
  cache = { produtos, expiraEm: Date.now() + VALIDADE_MS };
  return produtos;
};
