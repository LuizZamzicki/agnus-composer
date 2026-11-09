import Notificacoes from "../../src/models/Notificacoes";
import type Pedidos from "../../src/models/Pedidos";
import NotificacaoService from "../../src/services/notificacao.service";

jest.mock("../../src/models/Notificacoes", () => ({ __esModule: true, default: { create: jest.fn() } }));

const create = Notificacoes.create as jest.Mock;
const pedido = (status: string) => ({ id_pedido: 7, id_usuario: 3, status }) as unknown as Pedidos;

describe("NotificacaoService.avisarMudancaDeStatus", () => {
  it("avisa o dono do pedido quando o status muda", async () => {
    await NotificacaoService.avisarMudancaDeStatus(pedido("enviado"), "pago");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      id_usuario: 3,
      id_pedido: 7,
      titulo: "Pedido enviado",
    }));
  });

  it("não avisa quando o status continua o mesmo", async () => {
    await NotificacaoService.avisarMudancaDeStatus(pedido("pago"), "pago");
    expect(create).not.toHaveBeenCalled();
  });

  it("não propaga falha ao gravar o aviso", async () => {
    create.mockRejectedValueOnce(new Error("db"));
    await expect(NotificacaoService.avisarMudancaDeStatus(pedido("pago"), "aguardando_pagamento")).resolves.toBeUndefined();
  });
});
