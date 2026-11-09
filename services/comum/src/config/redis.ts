import Redis, { RedisOptions } from "ioredis";
import logger from "../utils/logger";

const MAX_RECONNECT_DELAY_MS = 5000;

const REDIS_OPTIONS: RedisOptions = {
  connectTimeout: 2000,
  commandTimeout: 500,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (attempt) => Math.min(attempt * 200, MAX_RECONNECT_DELAY_MS),
};

let commandClient: Redis | null = null;
const openConnections = new Set<Redis>();

export const isRedisConfigured = () => Boolean(process.env.REDIS_URL);

const createConnection = (role: string, options: RedisOptions = {}) => {
  const client = new Redis(process.env.REDIS_URL!, { ...REDIS_OPTIONS, ...options });

  client.on("ready", () => logger.info("redis.conectado", { role }));
  client.on("error", (error) => logger.warn("redis.erro", { role, error: error.message }));
  client.on("end", () => openConnections.delete(client));

  openConnections.add(client);
  return client;
};

export const getRedisClient = () => {
  if (!isRedisConfigured()) {
    return null;
  }

  commandClient ??= createConnection("comandos");
  return commandClient;
};

// Conexoes em modo subscribe ficam bloqueadas para outros comandos, por isso sao separadas.
export const createRedisSubscriber = () =>
  isRedisConfigured()
    ? createConnection("assinante", { enableOfflineQueue: true, commandTimeout: undefined })
    : null;

export const closeRedisConnections = async () => {
  await Promise.allSettled([...openConnections].map((client) => client.quit()));
  openConnections.clear();
  commandClient = null;
};
