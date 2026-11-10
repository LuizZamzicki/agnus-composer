import sequelize from "@agnus/comum/config/database";
import EventBusService from "@agnus/comum/services/eventBus.service";
import { HttpError } from "@agnus/comum/types/http_error";
import { chamarServico, consultarOuNull } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import { calculateSubtotal, consultarSelecoes, normalizeItemQuantity } from "@agnus/comum/utils/itemDetails";
import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";

export class CheckoutError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

type ItemDaSacola = {
  id_carrinho_item: number;
  id_produto_cor: number;
  id_produto_grade: number;
  quantidade: number | null;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

class CheckoutService {
  private static async ensureOwnAddress(userId: number, addressId: number) {
    const endereco = await consultarOuNull<{ id_usuario: number }>("identidade", `/enderecos/${addressId}`);

    if (!endereco || endereco.id_usuario !== userId) {
      throw new CheckoutError(404, "Endereço não encontrado.");
    }
  }

  private static async priceItems(itens: ItemDaSacola[]) {
    const selecoes = await consultarSelecoes(itens);

    return itens.map((item, indice) => {
      const context = selecoes[indice].contexto;

      if (!context || !context.produto.ativo) {
        throw new CheckoutError(409, "Uma peça da sua sacola não está mais disponível. Remova-a para continuar.");
      }

      const quantidade = normalizeItemQuantity(item.quantidade);

      return {
        id_produto_cor: item.id_produto_cor,
        id_produto_grade: item.id_produto_grade,
        quantidade,
        preco_unitario: context.precoUnitario,
        subtotal: calculateSubtotal(context.precoUnitario, quantidade),
      };
    });
  }

  private static async desfazerPedido(pedido: Pedidos) {
    await sequelize.transaction(async (transaction) => {
      await PedidoItens.destroy({ where: { id_pedido: pedido.id_pedido }, transaction });
      await pedido.destroy({ transaction });
    });
    logger.warn("checkout.compensado", { pedido: pedido.id_pedido });
  }

  // Saga: o pedido é gravado primeiro e a sacola é baixada por último. Se a baixa não confirmar todos
  // os itens (outra compra levou antes, ou o serviço caiu), o pedido é desfeito. O total vem sempre
  // dos preços do catálogo, nunca do navegador.
  private static async baixarSacola(pedido: Pedidos, itens: ItemDaSacola[]) {
    let removidos: number;

    try {
      ({ data: { removidos } } = await chamarServico<{ removidos: number }>("carrinho", "/itens/baixar", {
        method: "POST",
        body: { ids: itens.map((item) => item.id_carrinho_item) },
      }));
    } catch (error) {
      await CheckoutService.desfazerPedido(pedido);
      throw error instanceof HttpError ? error : new HttpError(503, "Não foi possível concluir a compra.");
    }

    if (removidos !== itens.length) {
      await CheckoutService.desfazerPedido(pedido);
      throw new CheckoutError(409, "Sua sacola mudou durante a compra. Confira as peças e tente novamente.");
    }
  }

  static async finalizar(userId: number, addressId: number) {
    await CheckoutService.ensureOwnAddress(userId, addressId);

    const { data: itens } = await chamarServico<ItemDaSacola[]>("carrinho", `/usuarios/${userId}/itens`);

    if (itens.length === 0) {
      throw new CheckoutError(400, "Sua sacola está vazia.");
    }

    const itensPedido = await CheckoutService.priceItems(itens);
    const pedido = await sequelize.transaction(async (transaction) => {
      const novoPedido = await Pedidos.create(
        {
          id_usuario: userId,
          id_usuario_endereco: addressId,
          status: "aguardando_pagamento",
          valor_total: roundMoney(itensPedido.reduce((total, item) => total + item.subtotal, 0)),
          valor_frete: 0,
        },
        { transaction },
      );

      await PedidoItens.bulkCreate(
        itensPedido.map((item) => ({ ...item, id_pedido: novoPedido.id_pedido })),
        { transaction },
      );

      return novoPedido;
    });

    await CheckoutService.baixarSacola(pedido, itens);
    await EventBusService.publish("pedido.criado", {
      id_pedido: pedido.id_pedido,
      id_usuario: pedido.id_usuario,
      status: pedido.status,
      valor_total: pedido.valor_total,
    });

    return pedido;
  }
}

export default CheckoutService;
