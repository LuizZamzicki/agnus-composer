import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import logger, { requestContext } from "../utils/logger";
import { recordRequest } from "../utils/metrics";

const IGNORED_PATHS = new Set(["/health"]);
const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

const resolveRequestId = (req: Request) => {
  const received = req.header("x-request-id");

  return received && REQUEST_ID_PATTERN.test(received) ? received : randomUUID();
};

const getLogLevel = (statusCode: number) => {
  if (statusCode >= 500) {
    return "error";
  }

  return statusCode >= 400 ? "warn" : "info";
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = resolveRequestId(req);
  const startedAt = process.hrtime.bigint();

  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    recordRequest(res.statusCode, durationMs);

    if (IGNORED_PATHS.has(req.path)) {
      return;
    }

    logger[getLogLevel(res.statusCode)]("http.request", {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    });
  });

  requestContext.run({ requestId }, next);
};
