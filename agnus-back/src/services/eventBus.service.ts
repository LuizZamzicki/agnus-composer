import { randomUUID } from "crypto";
import { createRedisSubscriber, getRedisClient } from "../config/redis";
import type {
  AgnusEvent,
  AgnusEventHandler,
  AgnusEventPayload,
  AgnusEventType,
} from "../types/event.types";
import logger, { getCurrentRequestId } from "../utils/logger";
import { incrementMetric } from "../utils/metrics";

export const EVENT_CHANNEL_PREFIX = "agnus.eventos.";

class EventBusService {
  static buildEvent(type: AgnusEventType, payload: AgnusEventPayload): AgnusEvent {
    return {
      id: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      source: process.env.SERVICE_NAME || "agnus-api",
      requestId: getCurrentRequestId(),
      payload,
    };
  }

  // Publicacao "fire and forget": uma falha no Redis nunca deve derrubar a operacao de negocio.
  static async publish(type: AgnusEventType, payload: AgnusEventPayload) {
    const client = getRedisClient();

    if (!client) {
      return null;
    }

    const event = EventBusService.buildEvent(type, payload);

    try {
      const receivers = await client.publish(EVENT_CHANNEL_PREFIX + type, JSON.stringify(event));
      incrementMetric("events_published_total");
      logger.info("evento.publicado", { eventId: event.id, type, receivers, payload });
      return event;
    } catch (error) {
      incrementMetric("events_publish_errors_total");
      logger.warn("evento.falha_publicacao", {
        eventId: event.id,
        type,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  static parseEvent(message: string) {
    try {
      return JSON.parse(message) as AgnusEvent;
    } catch {
      return null;
    }
  }

  static async subscribe(handler: AgnusEventHandler) {
    const subscriber = createRedisSubscriber();

    if (!subscriber) {
      throw new Error("REDIS_URL nao configurada: nao e possivel assinar eventos.");
    }

    subscriber.on("pmessage", async (_pattern, channel, message) => {
      const event = EventBusService.parseEvent(message);

      if (!event) {
        logger.warn("evento.invalido", { channel });
        return;
      }

      logger.info("evento.recebido", { eventId: event.id, type: event.type, channel, origemRequestId: event.requestId });

      try {
        await handler(event);
        incrementMetric("events_consumed_total");
      } catch (error) {
        incrementMetric("events_consume_errors_total");
        logger.error("evento.falha_processamento", { eventId: event.id, type: event.type, error });
      }
    });

    await subscriber.psubscribe(`${EVENT_CHANNEL_PREFIX}*`);
    logger.info("evento.assinatura_ativa", { pattern: `${EVENT_CHANNEL_PREFIX}*` });
    return subscriber;
  }
}

export default EventBusService;
