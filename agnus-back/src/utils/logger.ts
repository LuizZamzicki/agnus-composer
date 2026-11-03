import { AsyncLocalStorage } from "async_hooks";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;
type RequestContext = { requestId: string };

const LEVEL_WEIGHT: Record<LogLevel | "silent", number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

const getMinimumLevel = () => {
  const configured = process.env.LOG_LEVEL as LogLevel | "silent" | undefined;

  if (configured && configured in LEVEL_WEIGHT) {
    return LEVEL_WEIGHT[configured];
  }

  return process.env.NODE_ENV === "test" ? LEVEL_WEIGHT.silent : LEVEL_WEIGHT.info;
};

const serializeValue = (value: unknown) =>
  value instanceof Error
    ? { name: value.name, message: value.message, stack: value.stack }
    : value;

const serializeContext = (context: LogContext) =>
  Object.fromEntries(Object.entries(context).map(([key, value]) => [key, serializeValue(value)]));

const write = (level: LogLevel, message: string, context: LogContext = {}) => {
  if (LEVEL_WEIGHT[level] < getMinimumLevel()) {
    return;
  }

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: process.env.SERVICE_NAME || "agnus-api",
    message,
    requestId: requestContext.getStore()?.requestId,
    ...serializeContext(context),
  };
  const line = JSON.stringify(entry);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

export const getCurrentRequestId = () => requestContext.getStore()?.requestId;

const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};

export default logger;
