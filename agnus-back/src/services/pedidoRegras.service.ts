import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";
import type { PedidoStatus } from "../types/pedido.types";

// Regras do agregado Pedido (ver docs/arquitetura/ddd.md): fluxo de status permitido,
// quando os itens ainda podem mudar e como o total e formado.
const TRANSICOES: Record<PedidoStatus, readonly PedidoStatus[]> = {
  aguardando_calculo_frete: ["aguardando_pagamento", "cancelado"],
  aguardando_pagamento: ["pago", "cancelado"],
  pago: ["enviado", "cancelado"],
  enviado: ["entregue"],
  entregue: [],
  cancelado: [],
};

export const STATUS_ABERTOS: readonly PedidoStatus[] = ["aguardando_calculo_frete", "aguardando_pagamento"];

const roundMoney = (value: number) => Number(value.toFixed(2));

class PedidoRegrasService {
  static podeTransitar(atual: PedidoStatus, novo: PedidoStatus) {
    return atual === novo || TRANSICOES[atual].includes(novo);
  }

  static estaAberto(status: PedidoStatus) {
    return STATUS_ABERTOS.includes(status);
  }

  // valor_total = soma dos subtotais dos itens + frete. Nunca vem do cliente.
  static async recalcularTotal(pedido: Pedidos) {
    const itens = await PedidoItens.findAll({ where: { id_pedido: pedido.id_pedido } });
    const subtotais = itens.reduce((total, item) => total + Number(item.subtotal ?? 0), 0);

    await pedido.update({ valor_total: roundMoney(subtotais + Number(pedido.valor_frete ?? 0)) });
    return pedido;
  }
}

export default PedidoRegrasService;
