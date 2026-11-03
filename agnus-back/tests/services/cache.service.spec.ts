export {};

type MockRedis = {
  status: string;
  get: jest.Mock;
  set: jest.Mock;
  scan: jest.Mock;
  del: jest.Mock;
};

const buildRedis = (): MockRedis => ({
  status: "ready",
  get: jest.fn(),
  set: jest.fn(),
  scan: jest.fn(),
  del: jest.fn(),
});

const loadService = (redis: MockRedis | null) => {
  jest.resetModules();
  jest.doMock("../../src/config/redis", () => ({ __esModule: true, getRedisClient: () => redis }));
  const metrics = require("../../src/utils/metrics");
  metrics.resetMetrics();
  return {
    CacheService: require("../../src/services/cache.service").default,
    metrics,
  };
};

describe("cache.service", () => {
  it("monta chaves estaveis ignorando ordem e valores vazios", () => {
    const { CacheService } = loadService(null);

    expect(CacheService.buildKey("produtos", "lista", { page: "2", ativo: "true", q: "" }))
      .toBe("produtos:lista:ativo=true&page=2");
    expect(CacheService.buildKey("produtos", "lista", {})).toBe("produtos:lista:all");
    expect(CacheService.buildKey("produtos", "lista", { q: "x".repeat(300) })).toMatch(/^produtos:lista:[a-f0-9]{40}$/);
  });

  it("executa o loader direto quando o Redis nao esta configurado", async () => {
    const { CacheService } = loadService(null);
    const loader = jest.fn(async () => ({ data: [1] }));

    await expect(CacheService.getOrSet("k", 10, loader)).resolves.toEqual({ data: [1] });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("retorna o valor do cache em caso de hit sem chamar o loader", async () => {
    const redis = buildRedis();
    redis.get.mockResolvedValue(JSON.stringify({ data: "cacheado" }));
    const { CacheService, metrics } = loadService(redis);
    const loader = jest.fn();

    await expect(CacheService.getOrSet("produtos:detalhe:id=1", 60, loader)).resolves.toEqual({ data: "cacheado" });
    expect(loader).not.toHaveBeenCalled();
    expect(redis.get).toHaveBeenCalledWith("agnus:cache:produtos:detalhe:id=1");
    expect(metrics.getMetricsSnapshot().counters.cache_hits_total).toBe(1);
  });

  it("carrega da fonte e grava com TTL em caso de miss", async () => {
    const redis = buildRedis();
    redis.get.mockResolvedValue(null);
    const { CacheService, metrics } = loadService(redis);

    await expect(CacheService.getOrSet("k", 120, async () => ({ data: 1 }))).resolves.toEqual({ data: 1 });
    expect(redis.set).toHaveBeenCalledWith("agnus:cache:k", JSON.stringify({ data: 1 }), "EX", 120);
    expect(metrics.getMetricsSnapshot().counters.cache_misses_total).toBe(1);
  });

  it("nao grava resultados rejeitados pelo shouldCache", async () => {
    const redis = buildRedis();
    redis.get.mockResolvedValue(null);
    const { CacheService } = loadService(redis);

    await CacheService.getOrSet("k", 60, async () => ({ message: "erro" }), (value: object) => !("message" in value));
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("degrada para a fonte quando o Redis falha e abre o circuito apos falhas seguidas", async () => {
    const redis = buildRedis();
    redis.get.mockRejectedValue(new Error("timeout"));
    redis.set.mockRejectedValue(new Error("timeout"));
    const { CacheService } = loadService(redis);
    const loader = jest.fn(async () => "fonte");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(CacheService.getOrSet("k", 60, loader)).resolves.toBe("fonte");
    }

    redis.get.mockClear();
    await expect(CacheService.getOrSet("k", 60, loader)).resolves.toBe("fonte");
    expect(redis.get).not.toHaveBeenCalled();

    CacheService.resetCircuit();
    await CacheService.get("k");
    expect(redis.get).toHaveBeenCalled();
  });

  it("ignora o Redis quando a conexao ainda nao esta pronta", async () => {
    const redis = buildRedis();
    redis.status = "connecting";
    const { CacheService } = loadService(redis);

    await expect(CacheService.get("k")).resolves.toBeNull();
    await CacheService.set("k", 1, 10);
    await expect(CacheService.invalidateNamespace("produtos", "teste")).resolves.toBe(0);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("invalida todas as chaves do namespace usando SCAN", async () => {
    const redis = buildRedis();
    redis.scan
      .mockResolvedValueOnce(["7", ["agnus:cache:produtos:a", "agnus:cache:produtos:b"]])
      .mockResolvedValueOnce(["0", []]);
    redis.del.mockResolvedValue(2);
    const { CacheService } = loadService(redis);

    await expect(CacheService.invalidateNamespace("produtos", "produto.atualizado:1")).resolves.toBe(2);
    expect(redis.scan).toHaveBeenCalledWith("0", "MATCH", "agnus:cache:produtos:*", "COUNT", 200);
    expect(redis.scan).toHaveBeenCalledWith("7", "MATCH", "agnus:cache:produtos:*", "COUNT", 200);
    expect(redis.del).toHaveBeenCalledWith("agnus:cache:produtos:a", "agnus:cache:produtos:b");
  });

  it("retorna zero quando a invalidacao falha", async () => {
    const redis = buildRedis();
    redis.scan.mockRejectedValue(new Error("down"));
    const { CacheService } = loadService(redis);

    await expect(CacheService.invalidateNamespace("produtos", "x")).resolves.toBe(0);
  });

  it("retorna null para chave inexistente", async () => {
    const redis = buildRedis();
    redis.get.mockResolvedValue(null);
    const { CacheService } = loadService(redis);

    await expect(CacheService.get("k")).resolves.toBeNull();
  });
});
