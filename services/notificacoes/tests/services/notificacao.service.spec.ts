import Notificacoes from "../../src/models/Notificacoes";
import NotificacaoService from "../../src/services/notificacao.service";

jest.mock("../../src/models/Notificacoes", () => ({ __esModule: true, default: { create: jest.fn() } }));

const create = Notificacoes.create as jest.Mock;
const pedido = (status: "pago" | "enviado") => ({ id_pedido: 7, id_usuario: 3, status });

describe("NotificacaoService.avisarMudancaDeStatus", () => {
  it("avisa o dono do pedido quando o status muda", async () => {
    await NotificacaoService.avisarMudancaDeStatus(pedido("enviado"));
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      id_usuario: 3,
      id_pedido: 7,
      titulo: "Pedido enviado",
    }));
  });

  it("não propaga falha ao gravar o aviso", async () => {
    create.mockRejectedValueOnce(new Error("db"));
    await expect(NotificacaoService.avisarMudancaDeStatus(pedido("pago"))).resolves.toBeUndefined();
  });
});
