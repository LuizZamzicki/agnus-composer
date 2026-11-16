import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import { incrementMetric } from "@agnus/comum/utils/metrics";
import { lerConfiguracao, type ConfiguracaoShopify } from "../config";

const TIMEOUT_MS = 8000;

type ErroGraphQL = { message: string; extensions?: { code?: string } };
type RespostaGraphQL<T> = { data?: T; errors?: ErroGraphQL[] };

export type OpcoesConsulta = {
  // IP de quem compra: com token privado, o Shopify usa para limitar abuso por cliente.
  ipComprador?: string;
};

let configuracao: ConfiguracaoShopify | null | undefined;

export const configuracaoAtual = () => {
  configuracao ??= lerConfiguracao();
  return configuracao;
};

// Os testes trocam a configuração sem mexer em process.env.
export const definirConfiguracao = (nova: ConfiguracaoShopify | null | undefined) => {
  configuracao = nova;
};

export const lojaConfigurada = () => Boolean(configuracaoAtual());

const indisponivel = () => new HttpError(503, "A loja está temporariamente indisponível. Tente de novo em instantes.");

export const consultarShopify = async <T>(
  consulta: string,
  variaveis: Record<string, unknown> = {},
  { ipComprador }: OpcoesConsulta = {},
): Promise<T> => {
  const config = configuracaoAtual();

  if (!config) {
    throw new HttpError(503, "A loja ainda não foi configurada.");
  }

  const cabecalhos: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...config.cabecalhos,
  };

  if (config.tokenPrivado && ipComprador) {
    cabecalhos["Shopify-Storefront-Buyer-IP"] = ipComprador;
  }

  const inicio = Date.now();
  let resposta: Response;

  try {
    resposta = await fetch(config.endpoint, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ query: consulta, variables: { pais: config.pais, idioma: config.idioma, ...variaveis } }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    incrementMetric("shopify_errors_total");
    logger.error("shopify.sem_resposta", { error: error instanceof Error ? error.message : String(error) });
    throw indisponivel();
  }

  const corpo = (await resposta.json().catch(() => ({}))) as RespostaGraphQL<T>;
  const duracaoMs = Date.now() - inicio;

  if (!resposta.ok || corpo.errors?.length || !corpo.data) {
    incrementMetric("shopify_errors_total");
    const codigos = corpo.errors?.map((erro) => erro.extensions?.code ?? erro.message) ?? [];

    logger.error("shopify.erro", { status: resposta.status, codigos, duracaoMs });

    if (resposta.status === 401 || resposta.status === 403) {
      // Token errado ou sem escopo: é erro de configuração, mas o cliente só precisa saber que a loja caiu.
      throw indisponivel();
    }

    if (resposta.status === 429 || resposta.status === 430 || codigos.includes("THROTTLED")) {
      throw new HttpError(503, "A loja está com muito movimento agora. Tente de novo em instantes.");
    }

    throw indisponivel();
  }

  logger.debug("shopify.ok", { duracaoMs });
  return corpo.data;
};
