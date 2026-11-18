// Configuração da Storefront API. O token fica só no servidor: o navegador fala com /api/loja.
const VERSAO_PADRAO = "2026-07";

export type ConfiguracaoShopify = {
  endpoint: string;
  cabecalhos: Record<string, string>;
  tokenPrivado: boolean;
  pais: string;
  idioma: string;
};

const limpar = (valor: string | undefined) => (valor ?? "").trim();

// Aceita "agnus.myshopify.com", "https://agnus.myshopify.com/" ou um domínio próprio.
export const normalizarDominio = (valor: string) =>
  limpar(valor).replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();

export const lerConfiguracao = (env: NodeJS.ProcessEnv = process.env): ConfiguracaoShopify | null => {
  const dominio = normalizarDominio(env.SHOPIFY_STORE_DOMAIN ?? "");
  const privado = limpar(env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN);
  const publico = limpar(env.SHOPIFY_STOREFRONT_PUBLIC_TOKEN);
  const versao = limpar(env.SHOPIFY_API_VERSION) || VERSAO_PADRAO;

  if (!dominio || (!privado && !publico)) {
    return null;
  }

  // O token privado é o indicado para chamadas de servidor: não tem o limite por IP do público.
  const cabecalhos: Record<string, string> = privado
    ? { "Shopify-Storefront-Private-Token": privado }
    : { "X-Shopify-Storefront-Access-Token": publico };

  return {
    endpoint: `https://${dominio}/api/${versao}/graphql.json`,
    cabecalhos,
    tokenPrivado: Boolean(privado),
    pais: (limpar(env.SHOPIFY_PAIS) || "BR").toUpperCase(),
    idioma: (limpar(env.SHOPIFY_IDIOMA) || "PT_BR").toUpperCase(),
  };
};

// Admin API: só para ler os pedidos do cliente ("Meus pedidos"). Aceita um token fixo (app
// personalizado antigo, "shpat_...") ou client id + secret de um app do Dev Dashboard, trocados por
// um token de 24 h (client credentials grant).
export type ConfiguracaoAdmin = {
  endpoint: string;
  urlDoToken: string;
  token: string;
  clientId: string;
  clientSecret: string;
};

// A Admin API tem versão própria: os pedidos usam campos da 2026-10.
const VERSAO_ADMIN_PADRAO = "2026-10";

export const lerConfiguracaoAdmin = (env: NodeJS.ProcessEnv = process.env): ConfiguracaoAdmin | null => {
  const dominio = normalizarDominio(env.SHOPIFY_STORE_DOMAIN ?? "");
  const versao = limpar(env.SHOPIFY_ADMIN_API_VERSION) || VERSAO_ADMIN_PADRAO;
  const token = limpar(env.SHOPIFY_ADMIN_TOKEN);
  // Aceita também SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET, os nomes que o Dev Dashboard mostra.
  const clientId = limpar(env.SHOPIFY_ADMIN_CLIENT_ID) || limpar(env.SHOPIFY_CLIENT_ID);
  const clientSecret = limpar(env.SHOPIFY_ADMIN_CLIENT_SECRET) || limpar(env.SHOPIFY_CLIENT_SECRET);

  if (!dominio || (!token && !(clientId && clientSecret))) {
    return null;
  }

  return {
    endpoint: `https://${dominio}/admin/api/${versao}/graphql.json`,
    urlDoToken: `https://${dominio}/admin/oauth/access_token`,
    token,
    clientId,
    clientSecret,
  };
};

// TTLs em segundos. Preço e disponibilidade mudam no painel do Shopify, então o cache é curto.
export const CACHE_TTL = {
  vitrine: 60,
  produto: 120,
  colecoes: 600,
  relacionados: 300,
  // Pedido pago aparece em até meio minuto; status (enviado, entregue) muda no painel do Shopify.
  pedidos: 30,
} as const;

// Vínculo da sacola do Shopify com a conta do cliente; o Shopify expira carrinhos parados.
export const VINCULO_SACOLA_TTL = 60 * 60 * 24 * 30;
