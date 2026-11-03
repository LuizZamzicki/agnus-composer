import "dotenv/config";
import app from "./app";
import sequelize from "./config/database";
import { getRedisClient } from "./config/redis";
import {
  initializeProdutoSearchIndex,
  syncAllProdutosToSearchIndex,
} from "./services/produtoSearchIndex.service";
import logger from "./utils/logger";

const port = Number(process.env.PORT || 3000);

const bootstrap = async () => {
  await sequelize.sync({ alter: true });
  await initializeProdutoSearchIndex();
  await syncAllProdutosToSearchIndex();
  getRedisClient();

  app.listen(port, () => {
    logger.info("servidor.iniciado", { port });
  });
};

void bootstrap();
