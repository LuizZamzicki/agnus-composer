import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import { consultarSelecoes } from "@agnus/comum/utils/itemDetails";
import PedidoItens from "../../src/models/PedidoItens";
import Pedidos from "../../src/models/Pedidos";
import PedirAvaliacaoService, { diasParaPedirAvaliacao, produtosDoPedido } from "../../src/services/pedirAvaliacao.service";

jest.mock("@agnus/comum/utils/clienteInterno", () => ({ __esModule: true, chamarServico: jest.fn() }));
jest.mock("@agnus/comum/utils/itemDetails", () => ({ __esModule: true, consultarSelecoes: jest.fn() }));
jest.mock("../../src/models/PedidoItens", () => ({ __esModule: true, default: { findAll: jest.fn() } }));
jest.mock("../../src/models/Pedidos", () => ({ __esModule: true, default: { findAll: jest.fn(), sequelize: { where: jest.fn(() => ({})) } } }));

const contexto = (id: number, nome: string) => ({ contexto: { produto: { id_produto: id, nome }, foto: null } });

describe("Pedido de avaliação depois da entrega", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (Pedidos.sequelize!.where as jest.Mock).mockReturnValue({});
    delete process.env.DIAS_PARA_PEDIR_AVALIACAO;
  });

  it("espera 3 dias por padrão (configurável)", () => {
    expect(diasParaPedirAvaliacao()).toBe(3);
    process.env.DIAS_PARA_PEDIR_AVALIACAO = "5";
    expect(diasParaPedirAvaliacao()).toBe(5);
    process.env.DIAS_PARA_PEDIR_AVALIACAO = "abc";
    expect(diasParaPedirAvaliacao()).toBe(3);
  });

  it("lista cada peça uma vez (duas cores da mesma peça viram um link)", async () => {
    (PedidoItens.findAll as jest.Mock).mockResolvedValue([{}, {}, {}]);
    (consultarSelecoes as jest.Mock).mockResolvedValue([contexto(4, "Tank Top"), contexto(4, "Tank Top"), contexto(9, "Camiseta")]);

    await expect(produtosDoPedido(1)).resolves.toEqual([
      { id_produto: 4, nome: "Tank Top", foto: null },
      { id_produto: 9, nome: "Camiseta", foto: null },
    ]);
  });

  it("avisa as notificações e marca o pedido; se falhar, tenta na próxima rodada", async () => {
    const ok = { id_pedido: 1, id_usuario: 10, update: jest.fn() };
    const falha = { id_pedido: 2, id_usuario: 11, update: jest.fn() };
    (Pedidos.findAll as jest.Mock).mockResolvedValue([ok, falha]);
    (PedidoItens.findAll as jest.Mock).mockResolvedValue([{}]);
    (consultarSelecoes as jest.Mock).mockResolvedValue([contexto(4, "Tank Top")]);
    (chamarServico as jest.Mock).mockResolvedValueOnce({ status: 204 }).mockRejectedValueOnce(new Error("fora do ar"));
    const agora = new Date("2026-11-20T12:00:00Z");

    await expect(PedirAvaliacaoService.rodar(agora)).resolves.toEqual({ verificados: 2, enviados: 1 });

    expect(chamarServico).toHaveBeenCalledWith("notificacoes", "/pedir-avaliacao", expect.objectContaining({
      body: { id_usuario: 10, id_pedido: 1, produtos: [{ id_produto: 4, nome: "Tank Top", foto: null }] },
    }));
    expect(ok.update).toHaveBeenCalledWith({ avaliacao_pedida_em: agora });
    expect(falha.update).not.toHaveBeenCalled();
    expect((Pedidos.findAll as jest.Mock).mock.calls[0][0].where).toMatchObject({ status: "entregue", avaliacao_pedida_em: null });
  });
});
