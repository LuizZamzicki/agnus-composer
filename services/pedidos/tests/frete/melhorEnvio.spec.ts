import { configuracaoMelhorEnvio, cotarMelhorEnvio } from "../../src/frete/melhorEnvio";

describe("cliente do Melhor Envio", () => {
  const envOriginal = { ...process.env };
  const fetchOriginal = global.fetch;

  afterEach(() => {
    process.env = { ...envOriginal };
    global.fetch = fetchOriginal;
  });

  it("desligado sem token; sandbox quando pedido", () => {
    expect(configuracaoMelhorEnvio({})).toBeNull();
    expect(configuracaoMelhorEnvio({ MELHOR_ENVIO_TOKEN: "x", MELHOR_ENVIO_SANDBOX: "true" })?.url).toBe("https://sandbox.melhorenvio.com.br");
  });

  it("manda o pacote e devolve só os serviços que atendem o CEP", async () => {
    process.env.MELHOR_ENVIO_TOKEN = "tk";
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 1, name: "PAC", price: "22.10", delivery_time: 6, company: { name: "Correios" } },
        { id: 2, name: "SEDEX", price: "35.00", custom_price: "33.50", delivery_time: 3, custom_delivery_time: 4, company: { name: "Correios" } },
        { id: 3, name: ".Package", error: "Serviço indisponível para o trecho." },
      ],
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const opcoes = await cotarMelhorEnvio({ cepOrigem: "87010000", cepDestino: "01310100", pecas: 2, pesoPorPecaKg: 0.3, valorPecas: 150 });

    expect(opcoes).toEqual([
      { id: "me-1", nome: "PAC", empresa: "Correios", preco_cheio: 22.1, prazo_dias: 6 },
      { id: "me-2", nome: "SEDEX", empresa: "Correios", preco_cheio: 33.5, prazo_dias: 4 },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://melhorenvio.com.br/api/v2/me/shipment/calculate");
    expect(init.headers.Authorization).toBe("Bearer tk");
    expect(JSON.parse(init.body)).toMatchObject({ from: { postal_code: "87010000" }, to: { postal_code: "01310100" }, products: [{ quantity: 2, weight: 0.3, insurance_value: 75 }] });
  });

  it("erro HTTP vira exceção (quem chama usa a tabela)", async () => {
    process.env.MELHOR_ENVIO_TOKEN = "tk";
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(cotarMelhorEnvio({ cepOrigem: "1", cepDestino: "2", pecas: 1, pesoPorPecaKg: 0.3, valorPecas: 1 })).rejects.toThrow("401");
  });
});
