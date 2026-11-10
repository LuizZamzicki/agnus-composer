import EventBusService from "@agnus/comum/services/eventBus.service";
import type { AgnusEvent } from "@agnus/comum/types/event.types";
import logger from "@agnus/comum/utils/logger";
import AvaliacaoFotos from "./models/AvaliacaoFotos";
import AvaliacaoProdutos from "./models/AvaliacaoProdutos";
import { deleteAvaliacaoFotoFile } from "./utils/avaliacaoFotoStorage";

const removerAvaliacoes = async (where: { id_produto: number } | { id_usuario: number }) => {
  const avaliacoes = await AvaliacaoProdutos.findAll({ where, attributes: ["id_avaliacao_produto"] });
  const ids = avaliacoes.map((avaliacao) => avaliacao.id_avaliacao_produto);
  const fotos = await AvaliacaoFotos.findAll({ where: { id_avaliacao_produto: ids } });

  await AvaliacaoFotos.destroy({ where: { id_avaliacao_produto: ids } });
  await AvaliacaoProdutos.destroy({ where: { id_avaliacao_produto: ids } });

  for (const foto of fotos) {
    await deleteAvaliacaoFotoFile(foto.caminho_url ?? "").catch((error) =>
      logger.warn("avaliacao.falha_ao_apagar_foto", { foto: foto.caminho_url, error }),
    );
  }
};

export const tratarEvento = async (evento: AgnusEvent) => {
  if (evento.type === "produto.removido") {
    await removerAvaliacoes({ id_produto: Number(evento.payload.id_produto) });
  }

  if (evento.type === "usuario.removido") {
    await removerAvaliacoes({ id_usuario: Number(evento.payload.id_usuario) });
  }
};

export const assinarEventos = async () => {
  await EventBusService.subscribe(tratarEvento);
};
