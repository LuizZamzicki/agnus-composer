import Notificacoes from "../models/Notificacoes";
import type Pedidos from "../models/Pedidos";
import type { PedidoStatus } from "../types/pedido.types";
import logger from "../utils/logger";

const AVISOS_DE_STATUS: Partial<Record<PedidoStatus, { titulo: string; mensagem: (pedido: number) => string }>> = {
  aguardando_pagamento: {
    titulo: "Pedido aguardando pagamento",
    mensagem: (pedido) => `O pedido #${pedido} já pode ser pago.`,
  },
  pago: {
    titulo: "Pagamento confirmado",
    mensagem: (pedido) => `Recebemos o pagamento do pedido #${pedido}. Suas peças entram em produção.`,
  },
  enviado: {
    titulo: "Pedido enviado",
    mensagem: (pedido) => `O pedido #${pedido} saiu para entrega.`,
  },
  entregue: {
    titulo: "Pedido entregue",
    mensagem: (pedido) => `O pedido #${pedido} foi entregue. Conte como foram as peças.`,
  },
  cancelado: {
    titulo: "Pedido cancelado",
    mensagem: (pedido) => `O pedido #${pedido} foi cancelado.`,
  },
};

class NotificacaoService {
  // Gravada aqui, e nao no worker, porque o Pub/Sub perde o evento se o worker estiver fora do ar.
  // A falha so e registrada: o aviso nunca desfaz a mudanca de status.
  static async avisarMudancaDeStatus(pedido: Pedidos, statusAnterior: PedidoStatus) {
    const aviso = AVISOS_DE_STATUS[pedido.status];

    if (pedido.status === statusAnterior || !aviso) {
      return;
    }

    try {
      await Notificacoes.create({
        id_usuario: pedido.id_usuario,
        id_pedido: pedido.id_pedido,
        titulo: aviso.titulo,
        mensagem: aviso.mensagem(pedido.id_pedido),
      });
    } catch (error) {
      logger.error("notificacao.falha_ao_gravar", { pedido: pedido.id_pedido, error });
    }
  }
}

export default NotificacaoService;
