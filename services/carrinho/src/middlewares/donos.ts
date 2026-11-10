import type { OwnerResolver } from "@agnus/comum/middlewares/ownership.middleware";
import CarrinhoItens from "../models/CarrinhoItens";
import Carrinhos from "../models/Carrinhos";

const ownerOfCart: OwnerResolver = async (id) => (await Carrinhos.findByPk(id))?.id_usuario ?? null;

export const OWNERS = {
  carrinho: ownerOfCart,
  carrinhoItem: (async (id) => {
    const item = await CarrinhoItens.findByPk(id);
    return item ? ownerOfCart(item.id_carrinho) : null;
  }) as OwnerResolver,
};
