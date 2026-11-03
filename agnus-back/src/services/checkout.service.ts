import sequelize from "../config/database";
import CarrinhoItens from "../models/CarrinhoItens";
import Carrinhos from "../models/Carrinhos";
import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";
import UsuarioEnderecos from "../models/UsuarioEnderecos";
import { calculateSubtotal, normalizeItemQuantity, resolveProdutoContext } from "../utils/itemDetails";
import EventBusService from "./eventBus.service";

export class CheckoutError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const roundMoney = (value: number) => Number(value.toFixed(2));

class CheckoutService {
  private static async ensureOwnAddress(userId: number, addressId: number) {
    const endereco = await UsuarioEnderecos.findByPk(addressId);

    if (!endereco || endereco.id_usuario !== userId) {
      throw new CheckoutError(404, "Endereço não encontrado.");
    }
  }

  private static async priceItem(item: CarrinhoItens) {
    const context = await resolveProdutoContext(item.id_produto_cor, item.id_produto_grade);

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
  }

  // Pedido, itens e baixa da sacola entram na mesma transação: se algo falhar, nada é gravado e
  // a sacola continua intacta. O total vem dos preços do banco, nunca do navegador.
  static async finalizar(userId: number, addressId: number) {
    await CheckoutService.ensureOwnAddress(userId, addressId);

    const pedido = await sequelize.transaction(async (transaction) => {
      const carrinhos = await Carrinhos.findAll({ where: { id_usuario: userId }, transaction });
      const itens = await CarrinhoItens.findAll({
        where: { id_carrinho: carrinhos.map((carrinho) => carrinho.id_carrinho) },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (itens.length === 0) {
        throw new CheckoutError(400, "Sua sacola está vazia.");
      }

      const itensPedido = await Promise.all(itens.map(CheckoutService.priceItem));
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
      await CarrinhoItens.destroy({
        where: { id_carrinho_item: itens.map((item) => item.id_carrinho_item) },
        transaction,
      });

      return novoPedido;
    });

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
