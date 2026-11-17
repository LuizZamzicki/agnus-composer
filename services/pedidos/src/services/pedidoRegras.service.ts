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

// Parte do preço das peças que o cliente pagou (1 sem cupom; 0,9 com 10% de desconto).
export const fatorPago = (pedido: { valor_desconto?: number | string | null }, itens: { subtotal?: number | string | null }[]) => {
  const bruto = itens.reduce((total, item) => total + Number(item.subtotal ?? 0), 0);
  const desconto = Number(pedido.valor_desconto ?? 0);
  return bruto > 0 && desconto > 0 ? Math.max(0, (bruto - desconto) / bruto) : 1;
};

// O que o cliente paga: peças (já com desconto) + frete. É o "Total do pedido" dos avisos.
export const totalPago = (pedido: { valor_total?: number | string | null; valor_frete?: number | string | null }) =>
  pedido.valor_total == null ? null : Math.round((Number(pedido.valor_total) + Number(pedido.valor_frete ?? 0)) * 100) / 100;

class PedidoRegrasService {
  static podeTransitar(atual: PedidoStatus, novo: PedidoStatus) {
    return atual === novo || TRANSICOES[atual].includes(novo);
  }

  static estaAberto(status: PedidoStatus) {
    return STATUS_ABERTOS.includes(status);
  }

  // valor_total = soma dos subtotais dos itens - desconto do cupom. Nunca vem do cliente.
  // O frete fica à parte em valor_frete; o pagamento cobra valor_total + valor_frete.
  static async recalcularTotal(pedido: Pedidos) {
    const itens = await PedidoItens.findAll({ where: { id_pedido: pedido.id_pedido } });
    const subtotais = itens.reduce((total, item) => total + Number(item.subtotal ?? 0), 0);

    const desconto = Number(pedido.valor_desconto ?? 0);

    await pedido.update({ valor_total: roundMoney(Math.max(0, subtotais - desconto)) });
    return pedido;
  }
}

export default PedidoRegrasService;
