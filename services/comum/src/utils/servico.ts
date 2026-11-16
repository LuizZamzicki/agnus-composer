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
import { executarMigracoes, type Migracao } from "./migracoes";
import { getMetricsSnapshot } from "./metrics";

type ConfiguracaoApp = {
  rotas?: Router;
  interno?: Router;
  estaticos?: string[];
  // O BFF do admin troca esta rota pela consolidada de todos os serviços.
  metricasLocais?: boolean;
  // Prefixos que recebem fotos em base64 no JSON; o resto fica no limite pequeno.
  rotasComCorpoGrande?: string[];
};

const LIMITE_CORPO_PADRAO = "1mb";
const LIMITE_CORPO_GRANDE = "20mb";

// inflate: false — navegador não comprime corpo de requisição; aceitar gzip deixaria um corpo
// pequeno virar 20 MB de JSON antes mesmo da autenticação.
// O corpo bruto fica em req.rawBody: assinaturas (ex.: API de afiliados, estilo Shopee) são
// calculadas sobre os bytes exatos enviados, não sobre o JSON reserializado.
const parsersDoCorpo = (limit: string) => [
  express.json({
    limit,
    inflate: false,
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    },
  }),
  express.urlencoded({ extended: true, limit, inflate: false }),
];

const lerCorpo = (rotasComCorpoGrande: string[]) => {
  const [jsonPadrao, formPadrao] = parsersDoCorpo(LIMITE_CORPO_PADRAO);
  const [jsonGrande, formGrande] = parsersDoCorpo(LIMITE_CORPO_GRANDE);
  const ehGrande = (req: Request) =>
    rotasComCorpoGrande.some((prefixo) => req.path === prefixo || req.path.startsWith(`${prefixo}/`));

  return [
    (req: Request, res: Response, next: NextFunction) => (ehGrande(req) ? jsonGrande : jsonPadrao)(req, res, next),
    (req: Request, res: Response, next: NextFunction) => (ehGrande(req) ? formGrande : formPadrao)(req, res, next),
  ];
};

// Rotas /internal só aceitam chamadas de outros serviços; o gateway não as publica.
export const exigirTokenInterno = (req: Request, res: Response, next: NextFunction) => {
  const esperado = Buffer.from(process.env.INTERNAL_API_TOKEN ?? "");
  const recebido = Buffer.from(req.header("x-internal-token") ?? "");

  return esperado.length > 0 && esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
    ? next()
    : res.status(403).json({ message: "Acesso restrito aos serviços internos." });
};

export const criarApp = ({
  rotas,
  interno,
  estaticos = [],
  metricasLocais = true,
  rotasComCorpoGrande = [],
}: ConfiguracaoApp) => {
  const app = express();

  // Um proxy na frente (Nginx ou ngrok): o IP real do cliente e o ultimo do X-Forwarded-For.
  app.set("trust proxy", 1);
  app.use(requestLogger);
  app.use(cors());
  app.use(...lerCorpo(rotasComCorpoGrande));

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
  migracoes?: Migracao[];
  aoIniciar?: () => Promise<void> | void;
};

const TENTATIVAS_BANCO = 30;
const ESPERA_BANCO_MS = 2000;

// O esquema muda só por migrations versionadas; o sync automático alterava tabelas sem registro.
const prepararBanco = async (banco: Sequelize, migracoes: Migracao[]) => {
  for (let tentativa = 1; ; tentativa += 1) {
    try {
      await banco.authenticate();
      await executarMigracoes(banco, migracoes);
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

export const iniciarServico = async ({ app, banco, migracoes = [], aoIniciar }: Inicializacao) => {
  const porta = Number(process.env.PORT || 3000);

  try {
    // Sem nenhuma das duas, todo login cairia em erro 500; melhor nem subir.
    if (!process.env.JWT_PUBLIC_KEY && !process.env.JWT_SECRET) {
      throw new Error("Configure JWT_PUBLIC_KEY (ou JWT_SECRET) para conferir os tokens de sessão.");
    }

    if (banco) {
      await prepararBanco(banco, migracoes);
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
