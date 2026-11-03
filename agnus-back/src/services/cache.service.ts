import { createHash } from "crypto";
import { getRedisClient } from "../config/redis";
import logger from "../utils/logger";
import { incrementMetric } from "../utils/metrics";

const KEY_PREFIX = "agnus:cache:";
const MAX_READABLE_KEY_LENGTH = 200;
const FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 30000;
const SCAN_BATCH_SIZE = 200;

type CacheKeyParams = Record<string, unknown>;

class CacheService {
  private static consecutiveFailures = 0;
  private static circuitOpenUntil = 0;

  static buildKey(namespace: string, operation: string, params: CacheKeyParams = {}) {
    const serialized = Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== "")
      .sort()
      .map((key) => `${key}=${typeof params[key] === "string" ? params[key] : JSON.stringify(params[key])}`)
      .join("&");
    const suffix = serialized.length > MAX_READABLE_KEY_LENGTH
      ? createHash("sha1").update(serialized).digest("hex")
      : serialized || "all";

    return `${namespace}:${operation}:${suffix}`;
  }

  // Circuit breaker simples: apos falhas seguidas o Redis deixa de ser consultado por um tempo
  // e a aplicacao segue direto no banco, evitando somar timeouts em cada requisicao.
  private static getAvailableClient() {
    const client = getRedisClient();

    if (!client || client.status !== "ready" || Date.now() < CacheService.circuitOpenUntil) {
      return null;
    }

    return client;
  }

  private static registerSuccess() {
    CacheService.consecutiveFailures = 0;
  }

  private static registerFailure(operation: string, key: string, error: unknown) {
    CacheService.consecutiveFailures += 1;
    incrementMetric("cache_errors_total");
    logger.warn("cache.falha", {
      operation,
      key,
      consecutiveFailures: CacheService.consecutiveFailures,
      error: error instanceof Error ? error.message : String(error),
    });

    if (CacheService.consecutiveFailures >= FAILURE_THRESHOLD) {
      CacheService.circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      CacheService.consecutiveFailures = 0;
      logger.error("cache.circuito_aberto", { reabreEmMs: CIRCUIT_OPEN_MS });
    }
  }

  static async get<T>(key: string): Promise<T | null> {
    const client = CacheService.getAvailableClient();

    if (!client) {
      return null;
    }

    try {
      const value = await client.get(KEY_PREFIX + key);
      CacheService.registerSuccess();
      return value === null ? null : (JSON.parse(value) as T);
    } catch (error) {
      CacheService.registerFailure("get", key, error);
      return null;
    }
  }

  static async set(key: string, value: unknown, ttlSeconds: number) {
    const client = CacheService.getAvailableClient();

    if (!client) {
      return;
    }

    try {
      await client.set(KEY_PREFIX + key, JSON.stringify(value), "EX", ttlSeconds);
      CacheService.registerSuccess();
    } catch (error) {
      CacheService.registerFailure("set", key, error);
    }
  }

  // Cache-aside: tenta o cache, em caso de miss carrega da fonte e grava com TTL.
  static async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
  ): Promise<T> {
    const cached = await CacheService.get<T>(key);

    if (cached !== null) {
      incrementMetric("cache_hits_total");
      logger.info("cache.hit", { key });
      return cached;
    }

    incrementMetric("cache_misses_total");
    logger.info("cache.miss", { key, ttlSeconds });
    const value = await loader();

    if (shouldCache(value)) {
      await CacheService.set(key, value, ttlSeconds);
    }

    return value;
  }

  static async invalidateNamespace(namespace: string, reason: string) {
    const client = CacheService.getAvailableClient();

    if (!client) {
      return 0;
    }

    try {
      let cursor = "0";
      let removedKeys = 0;

      do {
        const [nextCursor, keys] = await client.scan(cursor, "MATCH", `${KEY_PREFIX}${namespace}:*`, "COUNT", SCAN_BATCH_SIZE);
        cursor = nextCursor;

        if (keys.length) {
          removedKeys += await client.del(...keys);
        }
      } while (cursor !== "0");

      CacheService.registerSuccess();
      incrementMetric("cache_invalidations_total");
      logger.info("cache.invalidado", { namespace, reason, removedKeys });
      return removedKeys;
    } catch (error) {
      CacheService.registerFailure("invalidate", namespace, error);
      return 0;
    }
  }

  static resetCircuit() {
    CacheService.consecutiveFailures = 0;
    CacheService.circuitOpenUntil = 0;
  }
}

export default CacheService;
