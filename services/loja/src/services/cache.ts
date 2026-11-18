import { createHash } from "crypto";
import { getRedisClient } from "@agnus/comum/config/redis";
import logger from "@agnus/comum/utils/logger";
import { incrementMetric } from "@agnus/comum/utils/metrics";

const PREFIXO = "agnus:loja:";

// Cliente pronto ou nada: com o Redis fora, a vitrine segue direto no Shopify.
const redisPronto = () => {
  const cliente = getRedisClient();
  return cliente?.status === "ready" ? cliente : null;
};

const aviso = (operacao: string, chave: string, error: unknown) =>
  logger.warn("cache.falha", { operacao, chave, error: error instanceof Error ? error.message : String(error) });

export const chaveDe = (operacao: string, params: Record<string, unknown> = {}) => {
  const serializado = JSON.stringify(
    Object.keys(params).sort().filter((k) => params[k] !== undefined && params[k] !== "").map((k) => [k, params[k]]),
  );

  return `${operacao}:${createHash("sha1").update(serializado).digest("hex")}`;
};

export const lerCache = async <T>(chave: string): Promise<T | null> => {
  const cliente = redisPronto();

  if (!cliente) return null;

  try {
    const valor = await cliente.get(PREFIXO + chave);
    return valor === null ? null : (JSON.parse(valor) as T);
  } catch (error) {
    aviso("get", chave, error);
    return null;
  }
};

export const gravarCache = async (chave: string, valor: unknown, ttlSegundos: number) => {
  const cliente = redisPronto();

  if (!cliente) return;

  try {
    await cliente.set(PREFIXO + chave, JSON.stringify(valor), "EX", ttlSegundos);
  } catch (error) {
    aviso("set", chave, error);
  }
};

export const apagarCache = async (chave: string) => {
  const cliente = redisPronto();

  if (!cliente) return;

  try {
    await cliente.del(PREFIXO + chave);
  } catch (error) {
    aviso("del", chave, error);
  }
};

// Cache-aside (ADR 0003): lê do Redis; na falta, busca no Shopify e grava com TTL.
export const comCache = async <T>(chave: string, ttlSegundos: number, carregar: () => Promise<T>): Promise<T> => {
  const emCache = await lerCache<T>(chave);

  if (emCache !== null) {
    incrementMetric("cache_hits_total");
    return emCache;
  }

  incrementMetric("cache_misses_total");
  const valor = await carregar();

  if (valor !== null && valor !== undefined) {
    await gravarCache(chave, valor, ttlSegundos);
  }

  return valor;
};
