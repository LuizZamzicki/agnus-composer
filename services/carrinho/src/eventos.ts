import { Op } from "sequelize";
import EventBusService from "@agnus/comum/services/eventBus.service";
import type { AgnusEvent } from "@agnus/comum/types/event.types";
import CarrinhoItens from "./models/CarrinhoItens";
import Carrinhos from "./models/Carrinhos";

export const tratarEvento = async (evento: AgnusEvent) => {
  if (evento.type === "produto.removido") {
    const cores = (evento.payload.cores ?? []) as number[];
    const grades = (evento.payload.grades ?? []) as number[];

    await CarrinhoItens.destroy({
      where: { [Op.or]: [{ id_produto_cor: cores }, { id_produto_grade: grades }] },
    });
  }

  if (evento.type === "usuario.removido") {
    const carrinhos = await Carrinhos.findAll({ where: { id_usuario: Number(evento.payload.id_usuario) } });
    const ids = carrinhos.map((carrinho) => carrinho.id_carrinho);

    await CarrinhoItens.destroy({ where: { id_carrinho: ids } });
    await Carrinhos.destroy({ where: { id_carrinho: ids } });
  }
};

export const assinarEventos = async () => {
  await EventBusService.subscribe(tratarEvento);
};
