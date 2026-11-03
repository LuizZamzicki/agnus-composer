export {};

type MessageListener = (pattern: string, channel: string, message: string) => Promise<void>;

const buildSubscriber = () => {
  const listeners: Record<string, MessageListener> = {};

  return {
    listeners,
    on: jest.fn((event: string, listener: MessageListener) => {
      listeners[event] = listener;
    }),
    psubscribe: jest.fn(async () => 1),
  };
};

const loadService = (
  publisher: { publish: jest.Mock } | null,
  subscriber: ReturnType<typeof buildSubscriber> | null = null,
) => {
  jest.resetModules();
  jest.doMock("../../src/config/redis", () => ({
    __esModule: true,
    getRedisClient: () => publisher,
    createRedisSubscriber: () => subscriber,
  }));
  return require("../../src/services/eventBus.service");
};

describe("eventBus.service", () => {
  it("nao publica quando o Redis nao esta configurado", async () => {
    const { default: EventBusService } = loadService(null);

    await expect(EventBusService.publish("produto.criado", { id_produto: 1 })).resolves.toBeNull();
  });

  it("publica o evento no canal do tipo com envelope padrao", async () => {
    const publisher = { publish: jest.fn(async () => 1) };
    const { default: EventBusService, EVENT_CHANNEL_PREFIX } = loadService(publisher);

    const event = await EventBusService.publish("pedido.criado", { id_pedido: 10 });

    expect(event).toMatchObject({ type: "pedido.criado", source: "agnus-api", payload: { id_pedido: 10 } });
    expect(event.id).toEqual(expect.any(String));
    expect(publisher.publish).toHaveBeenCalledWith(`${EVENT_CHANNEL_PREFIX}pedido.criado`, JSON.stringify(event));
  });

  it("nao propaga falhas de publicacao", async () => {
    const publisher = { publish: jest.fn(async () => { throw new Error("down"); }) };
    const { default: EventBusService } = loadService(publisher);

    await expect(EventBusService.publish("produto.removido", { id_produto: 1 })).resolves.toBeNull();
  });

  it("falha ao assinar sem Redis configurado", async () => {
    const { default: EventBusService } = loadService(null, null);

    await expect(EventBusService.subscribe(jest.fn())).rejects.toThrow("REDIS_URL");
  });

  it("assina o padrao de canais e entrega eventos validos ao handler", async () => {
    const subscriber = buildSubscriber();
    const { default: EventBusService, EVENT_CHANNEL_PREFIX } = loadService(null, subscriber);
    const handler = jest.fn();
    const event = { id: "1", type: "produto.criado", occurredAt: "", source: "agnus-api", payload: {} };

    await EventBusService.subscribe(handler);
    await subscriber.listeners.pmessage("p", `${EVENT_CHANNEL_PREFIX}produto.criado`, JSON.stringify(event));
    await subscriber.listeners.pmessage("p", "canal", "nao-e-json");

    expect(subscriber.psubscribe).toHaveBeenCalledWith(`${EVENT_CHANNEL_PREFIX}*`);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it("isola falhas do handler", async () => {
    const subscriber = buildSubscriber();
    const { default: EventBusService } = loadService(null, subscriber);

    await EventBusService.subscribe(jest.fn(async () => { throw new Error("boom"); }));

    await expect(
      subscriber.listeners.pmessage("p", "c", JSON.stringify({ id: "1", type: "pedido.criado", payload: {} })),
    ).resolves.toBeUndefined();
  });
});
