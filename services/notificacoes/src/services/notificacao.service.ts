import Notificacoes from "../models/Notificacoes";
import logger from "@agnus/comum/utils/logger";

type PedidoStatus = "aguardando_calculo_frete" | "aguardando_pagamento" | "pago" | "enviado" | "entregue" | "cancelado";
type PedidoAvisado = { id_usuario: number; id_pedido: number; status: PedidoStatus };

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
  static async avisarMudancaDeStatus(pedido: PedidoAvisado) {
    const aviso = AVISOS_DE_STATUS[pedido.status];

    if (!aviso) {
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
