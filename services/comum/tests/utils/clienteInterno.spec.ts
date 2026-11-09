import { chamarServico, consultarOuNull, reiniciarCircuitos } from "../../src/utils/clienteInterno";

const fetchMock = jest.fn();
const resposta = (status: number, corpo: unknown = {}) => ({ status, text: async () => JSON.stringify(corpo) });

describe("clienteInterno", () => {
  beforeEach(() => {
    process.env.INTERNAL_API_TOKEN = "segredo";
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    reiniciarCircuitos();
  });

  it("envia o token interno e devolve o corpo", async () => {
    fetchMock.mockResolvedValueOnce(resposta(200, { ok: true }));
    await expect(chamarServico("catalogo", "/x")).resolves.toEqual({ status: 200, data: { ok: true } });
    expect(fetchMock.mock.calls[0][0]).toBe("http://catalogo:3000/internal/x");
    expect(fetchMock.mock.calls[0][1].headers["x-internal-token"]).toBe("segredo");
  });

  it("repete uma leitura que falhou", async () => {
    fetchMock.mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(resposta(200));
    await expect(chamarServico("catalogo", "/x")).resolves.toMatchObject({ status: 200 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não repete escrita", async () => {
    fetchMock.mockRejectedValue(new Error("rede"));
    await expect(chamarServico("carrinho", "/x", { method: "POST" })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("trata 5xx como falha e responde 503", async () => {
    fetchMock.mockResolvedValue(resposta(500));
    await expect(chamarServico("pedidos", "/x")).rejects.toMatchObject({ status: 503 });
  });

  it("abre o circuito depois de falhas seguidas e para de chamar", async () => {
    fetchMock.mockRejectedValue(new Error("rede"));

    for (let i = 0; i < 5; i += 1) {
      await chamarServico("busca", "/x", { method: "POST" }).catch(() => undefined);
    }

    fetchMock.mockClear();
    await expect(chamarServico("busca", "/x", { method: "POST" })).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consultarOuNull transforma 404 em null", async () => {
    fetchMock.mockResolvedValueOnce(resposta(404, { message: "não existe" }));
    await expect(consultarOuNull("identidade", "/usuarios/1")).resolves.toBeNull();
  });
});
