const listenMock = jest.fn((port: number, callback: () => void) => {
  callback();
  return {} as unknown;
});
const syncMock = jest.fn();
const initializeProdutoSearchIndexMock = jest.fn(async () => true);
const syncAllProdutosToSearchIndexMock = jest.fn(async () => true);
const loggerInfoMock = jest.fn();

jest.mock("../src/app", () => ({
  __esModule: true,
  default: { listen: listenMock },
}));
jest.mock("../src/config/database", () => ({
  __esModule: true,
  default: { sync: syncMock },
}));
jest.mock("../src/services/produtoSearchIndex.service", () => ({
  __esModule: true,
  initializeProdutoSearchIndex: initializeProdutoSearchIndexMock,
  syncAllProdutosToSearchIndex: syncAllProdutosToSearchIndexMock,
}));

jest.mock("../src/config/redis", () => ({
  __esModule: true,
  getRedisClient: jest.fn(() => null),
}));
jest.mock("../src/utils/logger", () => ({
  __esModule: true,
  default: { info: loggerInfoMock, warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe("server bootstrap", () => {
  it("inicializa sequelize e starta app", async () => {
    process.env.PORT = "3333";
    await import("../src/server");
    await new Promise((resolve) => setImmediate(resolve));

    expect(syncMock).toHaveBeenCalledWith({ alter: true });
    expect(initializeProdutoSearchIndexMock).toHaveBeenCalled();
    expect(syncAllProdutosToSearchIndexMock).toHaveBeenCalled();
    expect(listenMock).toHaveBeenCalledWith(3333, expect.any(Function));
    expect(loggerInfoMock).toHaveBeenCalledWith("servidor.iniciado", { port: 3333 });
  });
});
