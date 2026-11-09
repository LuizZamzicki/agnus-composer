import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { parse as parseYaml } from 'yaml';
import authenticateToken, { authorizeRoles } from './middlewares/auth.middleware';
import { errorHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/requestLogger.middleware';
import routes from './routes';
import { getMetricsSnapshot } from './utils/metrics';
import cors from "cors";

const app = express();

// Um proxy na frente (Nginx ou ngrok): o IP real do cliente e o ultimo do X-Forwarded-For.
app.set('trust proxy', 1);

app.use(requestLogger);
app.use(cors());

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/produto_fotos', express.static(path.resolve(process.cwd(), 'produto_fotos')));
app.use('/avaliacao_fotos', express.static(path.resolve(process.cwd(), 'avaliacao_fotos')));

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/metrics', authenticateToken, authorizeRoles('administrador'), (_req: Request, res: Response) => {
  res.status(200).json(getMetricsSnapshot());
});

const openApiPath = path.resolve(process.cwd(), 'openapi.yaml');

if (fs.existsSync(openApiPath)) {
  const openApiDocument = parseYaml(fs.readFileSync(openApiPath, 'utf8'));

  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.status(200).json(openApiDocument);
  });
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument, { customSiteTitle: 'Agnus API' }));
}

app.use(routes);

app.use(errorHandler);

export default app;
