import { apiUrl } from "./api";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function normalizarInteiroPositivo(valor, fallback) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 1) {
    return fallback;
  }
  return Math.floor(numero);
}

export function extrairListaResposta(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.resultados)) return payload.resultados;
  if (Array.isArray(payload?.produtos)) return payload.produtos;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.categorias)) return payload.categorias;
  if (Array.isArray(payload?.categories)) return payload.categories;
  if (Array.isArray(payload?.usuarios)) return payload.usuarios;
  if (Array.isArray(payload?.users)) return payload.users;
  if (Array.isArray(payload?.pedidos)) return payload.pedidos;
  if (Array.isArray(payload?.orders)) return payload.orders;
  return [];
}

export function extrairMetaPaginacao(payload, { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = {}) {
  const lista = extrairListaResposta(payload);
  const paginaRaw = payload?.pagination ?? payload?.meta ?? {};
  const paginaAtual = normalizarInteiroPositivo(
    paginaRaw?.page ?? paginaRaw?.currentPage ?? payload?.page,
    normalizarInteiroPositivo(page, DEFAULT_PAGE)
  );
  const limiteAtual = normalizarInteiroPositivo(
    paginaRaw?.limit ?? paginaRaw?.perPage ?? payload?.limit,
    normalizarInteiroPositivo(limit, DEFAULT_LIMIT)
  );
  const total = normalizarInteiroPositivo(
    paginaRaw?.total ?? paginaRaw?.totalItems ?? payload?.total,
    lista.length
  );
  const totalPages = Math.max(
    1,
    normalizarInteiroPositivo(
      paginaRaw?.totalPages ?? paginaRaw?.lastPage,
      Math.ceil(Math.max(total, 1) / limiteAtual)
    )
  );
  const pageSafe = Math.min(paginaAtual, totalPages);

  return {
    page: pageSafe,
    limit: limiteAtual,
    total,
    totalPages,
    hasNextPage:
      typeof paginaRaw?.hasNextPage === "boolean" ? paginaRaw.hasNextPage : pageSafe < totalPages,
    hasPreviousPage:
      typeof paginaRaw?.hasPreviousPage === "boolean" ? paginaRaw.hasPreviousPage : pageSafe > 1,
  };
}

export function extrairRespostaPaginada(payload, options = {}) {
  const data = extrairListaResposta(payload);
  return {
    data,
    pagination: extrairMetaPaginacao(payload, options),
  };
}

export function construirUrlPaginada(url, { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, params = {} } = {}) {
  const [baseUrl, queryString = ""] = url.split("?");
  const searchParams = new URLSearchParams(queryString);

  searchParams.set("page", String(normalizarInteiroPositivo(page, DEFAULT_PAGE)));
  searchParams.set("limit", String(normalizarInteiroPositivo(limit, DEFAULT_LIMIT)));

  Object.entries(params).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === "") {
      searchParams.delete(chave);
      return;
    }
    searchParams.set(chave, String(valor));
  });

  const query = searchParams.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

export async function fetchJsonPaginado(
  url,
  {
    page = DEFAULT_PAGE,
    limit = DEFAULT_LIMIT,
    params = {},
    headers,
    signal,
    fetcher = fetch,
    fallbackPage = DEFAULT_PAGE,
    fallbackLimit = DEFAULT_LIMIT,
    ...options
  } = {}
) {
  let paginaAtual = normalizarInteiroPositivo(page, DEFAULT_PAGE);
  let limiteAtual = normalizarInteiroPositivo(limit, DEFAULT_LIMIT);
  let finalUrl = construirUrlPaginada(apiUrl(url), { page: paginaAtual, limit: limiteAtual, params });

  let response = await fetcher(finalUrl, {
    method: options.method || "GET",
    headers,
    signal,
    ...options,
  });
  let payload = await response.json().catch(() => null);

  const paginaFallback = normalizarInteiroPositivo(fallbackPage, DEFAULT_PAGE);
  const limiteFallback = normalizarInteiroPositivo(fallbackLimit, DEFAULT_LIMIT);

  if (response.status === 400 && (paginaAtual !== paginaFallback || limiteAtual !== limiteFallback)) {
    paginaAtual = paginaFallback;
    limiteAtual = limiteFallback;
    finalUrl = construirUrlPaginada(apiUrl(url), { page: paginaAtual, limit: limiteAtual, params });

    response = await fetcher(finalUrl, {
      method: options.method || "GET",
      headers,
      signal,
      ...options,
    });
    payload = await response.json().catch(() => null);
  }

  return {
    response,
    payload,
    ...extrairRespostaPaginada(payload, { page: paginaAtual, limit: limiteAtual }),
    request: {
      page: paginaAtual,
      limit: limiteAtual,
      url: finalUrl,
    },
  };
}

export const PAGINATION_DEFAULTS = {
  page: DEFAULT_PAGE,
  limit: DEFAULT_LIMIT,
};
