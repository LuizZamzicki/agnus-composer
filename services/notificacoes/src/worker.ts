import { getRedisClient } from "@agnus/comum/config/redis";
import EventBusService from "@agnus/comum/services/eventBus.service";
import type { AgnusEvent, AgnusEventHandler, AgnusEventType } from "@agnus/comum/types/event.types";
import logger from "@agnus/comum/utils/logger";
import Notificacoes from "./models/Notificacoes";

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
  "pedido.removido": async (event) => {
    await Notificacoes.destroy({ where: { id_pedido: Number(event.payload.id_pedido) } });
  },
  "usuario.removido": async (event) => {
    await Notificacoes.destroy({ where: { id_usuario: Number(event.payload.id_usuario) } });
  },
  "pedido.criado": (event) => {
    logger.info("notificacao.equipe_vendas", {
      eventId: event.id,
      pedido: event.payload.id_pedido,
      valorTotal: event.payload.valor_total,
      mensagem: "Novo pedido recebido. Iniciar produção sob demanda após confirmação do pagamento.",
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

// A auditoria e um efeito secundario: se o Redis falhar nela, a notificacao segue mesmo assim.
const processarEvento = async (event: AgnusEvent) => {
  try {
    await registrarAuditoria(event);
  } catch (error) {
    logger.warn("auditoria.falha", {
      eventId: event.id,
      type: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await handlers[event.type]?.(event);
};

// A conexao de comandos nao tem fila offline: sem esperar o "ready", o primeiro evento
// depois de cada inicio do worker falhava ao gravar a auditoria.
const aguardarConexaoDeComandos = async () => {
  const client = getRedisClient();

  if (client && client.status !== "ready") {
    await new Promise<void>((resolve) => client.once("ready", () => resolve()));
  }
};

// Consumidor dos eventos: roda dentro do servico de notificacoes, que e o dono desse assunto.
export const iniciarConsumidor = async () => {
  await aguardarConexaoDeComandos();
  await EventBusService.subscribe(processarEvento);
  logger.info("worker.iniciado");
};
