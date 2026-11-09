import type { OwnerResolver } from "@agnus/comum/middlewares/ownership.middleware";
import AvaliacaoFotos from "../models/AvaliacaoFotos";
import AvaliacaoProdutos from "../models/AvaliacaoProdutos";

const ownerOfReview: OwnerResolver = async (id) => (await AvaliacaoProdutos.findByPk(id))?.id_usuario ?? null;

export const OWNERS = {
  avaliacao: ownerOfReview,
  avaliacaoFoto: (async (id) => {
    const foto = await AvaliacaoFotos.findByPk(id);
    return foto ? ownerOfReview(foto.id_avaliacao_produto) : null;
  }) as OwnerResolver,
};
