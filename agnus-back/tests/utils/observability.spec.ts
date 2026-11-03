import express from "express";
import request from "supertest";
import { requestLogger } from "../../src/middlewares/requestLogger.middleware";
import logger, { getCurrentRequestId, requestContext } from "../../src/utils/logger";
import { getMetricsSnapshot, incrementMetric, recordRequest, resetMetrics } from "../../src/utils/metrics";

describe("logger", () => {
  const originalLevel = process.env.LOG_LEVEL;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.LOG_LEVEL = originalLevel;
    jest.restoreAllMocks();
  });

  it("fica silencioso em testes por padrao", () => {
    delete process.env.LOG_LEVEL;
    logger.error("nada");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("escreve JSON estruturado com requestId e erro serializado", () => {
    process.env.LOG_LEVEL = "debug";

    requestContext.run({ requestId: "req-1" }, () => {
      logger.info("ok", { a: 1 });
      logger.warn("atencao");
      logger.error("falha", { error: new Error("boom") });
      logger.debug("detalhe");
      expect(getCurrentRequestId()).toBe("req-1");
    });

    const info = JSON.parse(logSpy.mock.calls[0][0]);
    const error = JSON.parse(errorSpy.mock.calls[0][0]);

    expect(info).toMatchObject({ level: "info", message: "ok", requestId: "req-1", a: 1, service: "agnus-api" });
    expect(error.error).toMatchObject({ name: "Error", message: "boom" });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(2);
  });

  it("respeita o nivel minimo configurado", () => {
    process.env.LOG_LEVEL = "warn";
    logger.info("ignorado");
    logger.warn("exibido");
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe("metrics", () => {
  beforeEach(() => resetMetrics());

  it("calcula percentis, disponibilidade e taxa de acerto do cache", () => {
    [10, 20, 30, 40].forEach((duration) => recordRequest(200, duration));
    recordRequest(500, 100);
    incrementMetric("cache_hits_total", 3);
    incrementMetric("cache_misses_total");

    const snapshot = getMetricsSnapshot();

    expect(snapshot.counters).toMatchObject({ http_requests_total: 5, http_requests_2xx: 4, http_requests_5xx: 1 });
    expect(snapshot.latencyMs).toMatchObject({ window: 5, p50: 30, p95: 100 });
    expect(snapshot.sli).toEqual({ availability: 0.8, cacheHitRatio: 0.75 });
  });

  it("retorna valores neutros sem trafego", () => {
    expect(getMetricsSnapshot().sli).toEqual({ availability: null, cacheHitRatio: null });
    expect(getMetricsSnapshot().latencyMs.p95).toBe(0);
  });

  it("mantem apenas a janela recente de latencias", () => {
    for (let index = 0; index < 1005; index += 1) {
      recordRequest(200, index);
    }

    expect(getMetricsSnapshot().latencyMs.window).toBe(1000);
  });
});

describe("requestLogger middleware", () => {
  const buildApp = () => {
    const app = express();
    app.use(requestLogger);
    app.get("/health", (_req, res) => res.json({ ok: true }));
    app.get("/id", (_req, res) => res.json({ requestId: getCurrentRequestId() }));
    app.get("/erro", (_req, res) => res.status(500).json({}));
    app.get("/nao-encontrado", (_req, res) => res.status(404).json({}));
    return app;
  };

  beforeEach(() => resetMetrics());

  it("propaga o X-Request-Id recebido para o contexto e para a resposta", async () => {
    const res = await request(buildApp()).get("/id").set("X-Request-Id", "abc-123");

    expect(res.headers["x-request-id"]).toBe("abc-123");
    expect(res.body.requestId).toBe("abc-123");
  });

  it("gera um id novo quando o recebido e invalido", async () => {
    const res = await request(buildApp()).get("/id").set("X-Request-Id", "invalido com espaco");

    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("contabiliza requisicoes por classe de status", async () => {
    const app = buildApp();

    await request(app).get("/health");
    await request(app).get("/erro");
    await request(app).get("/nao-encontrado");

    expect(getMetricsSnapshot().counters).toMatchObject({
      http_requests_total: 3,
      http_requests_2xx: 1,
      http_requests_4xx: 1,
      http_requests_5xx: 1,
    });
  });
});
