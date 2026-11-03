import "dotenv/config";
import { closeRedisConnections, getRedisClient } from "./config/redis";
import EventBusService from "./services/eventBus.service";
import type { AgnusEvent, AgnusEventHandler, AgnusEventType } from "./types/event.types";
import logger from "./utils/logger";

process.env.SERVICE_NAME ||= "agnus-worker";

const AUDIT_LIST_KEY = "agnus:auditoria:eventos";
const AUDIT_LIST_SIZE = 500;

// Trilha de auditoria: mantem os ultimos eventos consumidos para consulta via redis-cli.
const registrarAuditoria = async (event: AgnusEvent) => {
  const client = getRedisClient();

  if (!client) {
    return;
  }

  await client.lpush(AUDIT_LIST_KEY, JSON.stringify(event));
  await client.ltrim(AUDIT_LIST_KEY, 0, AUDIT_LIST_SIZE - 1);
};

// Notificacoes ainda sao simuladas via log; o ponto de extensao para e-mail/WhatsApp fica aqui.
const handlers: Partial<Record<AgnusEventType, AgnusEventHandler>> = {
  "pedido.criado": (event) => {
    logger.info("notificacao.equipe_vendas", {
      eventId: event.id,
      pedido: event.payload.id_pedido,
      valorTotal: event.payload.valor_total,
      mensagem: "Novo pedido recebido. Iniciar producao sob demanda apos confirmacao do pagamento.",
    });
  },
  "pedido.atualizado": (event) => {
    if (event.payload.status === event.payload.status_anterior) {
      return;
    }

    logger.info("notificacao.cliente", {
      eventId: event.id,
      pedido: event.payload.id_pedido,
      usuario: event.payload.id_usuario,
      statusAnterior: event.payload.status_anterior,
      statusNovo: event.payload.status,
      mensagem: "Status do pedido alterado. Cliente deve ser avisado.",
    });
  },
};

const processarEvento = async (event: AgnusEvent) => {
  await registrarAuditoria(event);
  await handlers[event.type]?.(event);
};

const shutdown = async (signal: string) => {
  logger.info("worker.encerrando", { signal });
  await closeRedisConnections();
  process.exit(0);
};

const bootstrap = async () => {
  await EventBusService.subscribe(processarEvento);
  logger.info("worker.iniciado");

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
};

bootstrap().catch((error) => {
  logger.error("worker.falha_inicializacao", { error });
  process.exit(1);
});
