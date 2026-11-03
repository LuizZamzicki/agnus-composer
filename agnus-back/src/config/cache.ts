// TTLs em segundos. Valores curtos onde o dado muda com frequencia (vendas),
// mais longos onde a mudanca so acontece por acao administrativa (categorias).
export const CACHE_TTL = {
  produtosLista: 120,
  produtosCatalogo: 120,
  produtosMaisVendidos: 60,
  produtoDetalhe: 300,
  categoriasLista: 600,
  categoriaDetalhe: 600,
} as const;

export const CACHE_NAMESPACES = {
  produtos: "produtos",
  categorias: "categorias",
} as const;
