import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import type Pedidos from "../models/Pedidos";
import AfiliacaoService from "./afiliacao.service";
import type { PedidoStatus } from "../types/pedido.types";

class AvisoPedidoService {
  // Chamada direta, e nao evento, porque o Pub/Sub perde a mensagem se o consumidor estiver fora do ar.
  // A falha so e registrada: o aviso nunca desfaz a mudanca de status.
  static async avisarMudancaDeStatus(pedido: Pedidos, statusAnterior: PedidoStatus) {
    if (pedido.status === statusAnterior) {
      return;
    }

    try {
      await chamarServico("notificacoes", "/status-pedido", {
        method: "POST",
        body: {
          id_usuario: pedido.id_usuario,
          id_pedido: pedido.id_pedido,
          status: pedido.status,
          valor_total: pedido.valor_total == null ? null : Number(pedido.valor_total),
        },
      });
    } catch (error) {
      logger.error("notificacao.falha_ao_avisar", { pedido: pedido.id_pedido, error });
    }

    await AfiliacaoService.avisarStatus(pedido);
  }
}

export default AvisoPedidoService;
