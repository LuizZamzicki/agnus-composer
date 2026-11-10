import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import type Pedidos from "../../src/models/Pedidos";
import AvisoPedidoService from "../../src/services/avisoPedido.service";

jest.mock("@agnus/comum/utils/clienteInterno", () => ({ __esModule: true, chamarServico: jest.fn() }));

const chamar = chamarServico as jest.Mock;
const pedido = (status: string) => ({ id_pedido: 7, id_usuario: 3, status }) as unknown as Pedidos;

describe("AvisoPedidoService", () => {
  it("avisa o serviço de notificações quando o status muda", async () => {
    await AvisoPedidoService.avisarMudancaDeStatus(pedido("enviado"), "pago");
    expect(chamar).toHaveBeenCalledWith("notificacoes", "/status-pedido", {
      method: "POST",
      body: { id_usuario: 3, id_pedido: 7, status: "enviado" },
    });
  });

  it("não avisa quando o status continua o mesmo", async () => {
    await AvisoPedidoService.avisarMudancaDeStatus(pedido("pago"), "pago");
    expect(chamar).not.toHaveBeenCalled();
  });

  it("não propaga falha do serviço de notificações", async () => {
    chamar.mockRejectedValueOnce(new Error("fora do ar"));
    await expect(AvisoPedidoService.avisarMudancaDeStatus(pedido("pago"), "aguardando_pagamento")).resolves.toBeUndefined();
  });
});
