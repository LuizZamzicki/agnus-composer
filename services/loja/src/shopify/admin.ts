import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import { incrementMetric } from "@agnus/comum/utils/metrics";
import { lerConfiguracaoAdmin, type ConfiguracaoAdmin } from "../config";

// Cliente da Admin API do Shopify. Usado só para leitura de pedidos; a vitrine e a sacola seguem na
// Storefront API (cliente.ts).
const TIMEOUT_MS = 8000;
// Renova o token um pouco antes de vencer, para nenhuma chamada sair com token expirado.
const MARGEM_RENOVACAO_MS = 5 * 60 * 1000;

type ErroGraphQL = { message: string; extensions?: { code?: string } };

let configuracao: ConfiguracaoAdmin | null | undefined;
let tokenEmCache: { valor: string; venceEm: number } | null = null;

const configuracaoAtual = () => {
  configuracao ??= lerConfiguracaoAdmin();
  return configuracao;
};

// Os testes trocam a configuração sem mexer em process.env.
export const definirConfiguracaoAdmin = (nova: ConfiguracaoAdmin | null | undefined) => {
  configuracao = nova;
  tokenEmCache = null;
};

export const adminConfigurado = () => Boolean(configuracaoAtual());

const indisponivel = () => new HttpError(503, "Os pedidos da loja estão temporariamente indisponíveis.");

// App do Dev Dashboard: troca client id + secret por um token de 24 h (client credentials grant).
const obterToken = async (config: ConfiguracaoAdmin) => {
  if (config.token) {
    return config.token;
  }

  if (tokenEmCache && tokenEmCache.venceEm - MARGEM_RENOVACAO_MS > Date.now()) {
    return tokenEmCache.valor;
  }

  let resposta: Response;

  try {
    resposta = await fetch(config.urlDoToken, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    logger.error("shopify_admin.token_sem_resposta", { error: error instanceof Error ? error.message : String(error) });
    throw indisponivel();
  }

  const corpo = (await resposta.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };

  if (!resposta.ok || !corpo.access_token) {
    // Client id/secret errados, ou app não instalado na loja: erro de configuração.
    logger.error("shopify_admin.token_recusado", { status: resposta.status, erro: corpo.error });
    throw indisponivel();
  }

  tokenEmCache = { valor: corpo.access_token, venceEm: Date.now() + (corpo.expires_in ?? 86399) * 1000 };
  logger.info("shopify_admin.token_obtido", { expiraEmSegundos: corpo.expires_in ?? 86399 });
  void conferirEscopos(config, tokenEmCache.valor);
  return tokenEmCache.valor;
};

const ESCOPOS_NECESSARIOS = ["read_orders"];

// Diagnóstico: a cada token novo, registra no log os escopos que o app realmente tem na loja.
// Sem read_orders a busca de pedidos volta ACCESS_DENIED; sem read_all_orders, só os últimos 60 dias.
const conferirEscopos = async (config: ConfiguracaoAdmin, token: string) => {
  try {
    const resposta = await fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: "{ currentAppInstallation { accessScopes { handle } } }" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const corpo = (await resposta.json().catch(() => ({}))) as {
      data?: { currentAppInstallation?: { accessScopes?: { handle: string }[] } };
      errors?: unknown;
    };
    const escopos = (corpo.data?.currentAppInstallation?.accessScopes ?? []).map((escopo) => escopo.handle);
    const faltando = ESCOPOS_NECESSARIOS.filter((escopo) => !escopos.includes(escopo));

    if (faltando.length || corpo.errors) {
      logger.error("shopify_admin.escopos_insuficientes", { escopos, faltando, erros: corpo.errors });
    } else {
      logger.info("shopify_admin.escopos", { escopos });
    }
  } catch (error) {
    logger.warn("shopify_admin.escopos_sem_resposta", { error: error instanceof Error ? error.message : String(error) });
  }
};

export const consultarAdmin = async <T>(consulta: string, variaveis: Record<string, unknown> = {}): Promise<T> => {
  const config = configuracaoAtual();

  if (!config) {
    throw new HttpError(503, "Os pedidos da loja ainda não foram configurados.");
  }

  const enviar = async (token: string) =>
    fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: consulta, variables: variaveis }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let resposta: Response;

  try {
    resposta = await enviar(await obterToken(config));

    // Token de 24 h revogado antes da hora (app reinstalado): pede outro uma vez.
    if (resposta.status === 401 && !config.token) {
      tokenEmCache = null;
      resposta = await enviar(await obterToken(config));
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    incrementMetric("shopify_errors_total");
    logger.error("shopify_admin.sem_resposta", { error: error instanceof Error ? error.message : String(error) });
    throw indisponivel();
  }

  const corpo = (await resposta.json().catch(() => ({}))) as { data?: T; errors?: ErroGraphQL[] | string };

  if (!resposta.ok || corpo.errors || !corpo.data) {
    incrementMetric("shopify_errors_total");
    const erros = Array.isArray(corpo.errors) ? corpo.errors : corpo.errors ? [{ message: corpo.errors }] : [];
    // A Shopify pode responder 200 com o erro só no array "errors"; ele vai inteiro para o log.
    // "ACCESS_DENIED" aqui quase sempre é escopo faltando (read_orders) no app.
    logger.error("shopify_admin.erro", {
      status: resposta.status,
      erros: erros.map((erro) => ({ codigo: erro.extensions?.code ?? null, mensagem: erro.message })),
    });
    throw indisponivel();
  }

  return corpo.data;
};
