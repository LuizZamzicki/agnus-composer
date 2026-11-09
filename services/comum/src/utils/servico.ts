import cors from "cors";
import express, { NextFunction, Request, Response, Router } from "express";
import fs from "fs";
import path from "path";
import { timingSafeEqual } from "crypto";
import type { Sequelize } from "sequelize";
import swaggerUi from "swagger-ui-express";
import { parse as parseYaml } from "yaml";
import { getRedisClient } from "../config/redis";
import authenticateToken, { authorizeRoles } from "../middlewares/auth.middleware";
import { errorHandler } from "../middlewares/error.middleware";
import { requestLogger } from "../middlewares/requestLogger.middleware";
import logger from "./logger";
import { getMetricsSnapshot } from "./metrics";

type ConfiguracaoApp = {
  rotas?: Router;
  interno?: Router;
  estaticos?: string[];
  // O BFF do admin troca esta rota pela consolidada de todos os serviços.
  metricasLocais?: boolean;
};

// Rotas /internal só aceitam chamadas de outros serviços; o gateway não as publica.
export const exigirTokenInterno = (req: Request, res: Response, next: NextFunction) => {
  const esperado = Buffer.from(process.env.INTERNAL_API_TOKEN ?? "");
  const recebido = Buffer.from(req.header("x-internal-token") ?? "");

  return esperado.length > 0 && esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
    ? next()
    : res.status(403).json({ message: "Acesso restrito aos serviços internos." });
};

export const criarApp = ({ rotas, interno, estaticos = [], metricasLocais = true }: ConfiguracaoApp) => {
  const app = express();

  // Um proxy na frente (Nginx ou ngrok): o IP real do cliente e o ultimo do X-Forwarded-For.
  app.set("trust proxy", 1);
  app.use(requestLogger);
  app.use(cors());
  app.use(express.json({ limit: "20mb" }));
  app.use(express.urlencoded({ extended: true, limit: "20mb" }));

  for (const pasta of estaticos) {
    app.use(`/${pasta}`, express.static(path.resolve(process.cwd(), pasta)));
  }

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", servico: process.env.SERVICE_NAME });
  });

  if (metricasLocais) {
    app.get("/metrics", authenticateToken, authorizeRoles("administrador"), (_req: Request, res: Response) => {
      res.status(200).json(getMetricsSnapshot());
    });
  }

  const caminhoOpenApi = path.resolve(process.cwd(), "openapi.yaml");

  if (fs.existsSync(caminhoOpenApi)) {
    const documento = parseYaml(fs.readFileSync(caminhoOpenApi, "utf8"));

    app.get("/openapi.json", (_req: Request, res: Response) => {
      res.status(200).json(documento);
    });
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(documento, { customSiteTitle: "Agnus API" }));
  }

  if (interno) {
    app.use("/internal", exigirTokenInterno, interno);
  }

  if (rotas) {
    app.use(rotas);
  }

  app.use(errorHandler);

  return app;
};

type Inicializacao = {
  app: ReturnType<typeof express>;
  banco?: Sequelize;
  aoIniciar?: () => Promise<void> | void;
};

const TENTATIVAS_BANCO = 30;
const ESPERA_BANCO_MS = 2000;

const prepararBanco = async (banco: Sequelize) => {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      await banco.sync({ alter: true });
      return;
    } catch (error) {
      if (tentativa >= TENTATIVAS_BANCO) {
        throw error;
      }

      logger.warn("banco.aguardando", { tentativa, error: error instanceof Error ? error.message : String(error) });
      await new Promise((resolve) => setTimeout(resolve, ESPERA_BANCO_MS));
    }
  }
};

export const iniciarServico = async ({ app, banco, aoIniciar }: Inicializacao) => {
  const porta = Number(process.env.PORT || 3000);

  try {
    if (banco) {
      await prepararBanco(banco);
    }

    // A conexão não tem fila offline: sem abri-la agora, o primeiro evento publicado se perderia.
    getRedisClient();
    await aoIniciar?.();
    app.listen(porta, () => logger.info("servidor.iniciado", { port: porta }));
  } catch (error) {
    logger.error("servidor.falha_inicializacao", { error });
    process.exit(1);
  }
};
