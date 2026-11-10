import AdminService from "../src/services/admin.service";

const fetchMock = jest.fn();
const ok = (corpo: unknown) => ({ ok: true, json: async () => corpo });

describe("AdminService", () => {
  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
  });

  it("agrega os totais dos serviços com o token de quem pediu", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/orders")) return ok([{ id_pedido: 1 }, { id_pedido: 2 }]);
      return ok({ data: [{}], pagination: { total: 40 } });
    });

    const painel = await AdminService.dashboard("Bearer t");

    expect(painel.totais).toEqual({ usuarios: 40, produtos: 40, categorias: 40, pedidos: 2 });
    expect(painel.indisponiveis).toEqual([]);
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer t");
  });

  it("segue respondendo quando um serviço está fora do ar", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("pedidos")) throw new Error("rede");
      return ok({ data: [], pagination: { total: 1 } });
    });

    const painel = await AdminService.dashboard("Bearer t");

    expect(painel.totais.pedidos).toBe(0);
    expect(painel.indisponiveis).toEqual(["pedidos"]);
  });
});
