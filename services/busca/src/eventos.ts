import EventBusService from "@agnus/comum/services/eventBus.service";
import type { AgnusEvent } from "@agnus/comum/types/event.types";
import logger from "@agnus/comum/utils/logger";
import {
  initializeProdutoSearchIndex,
  removeProdutoFromSearchIndex,
  syncAllProdutosToSearchIndex,
  syncProdutoToSearchIndex,
} from "./services/produtoSearchIndex.service";

const INTERVALO_RECONCILIACAO_MS = 5 * 60 * 1000;
const ESPERA_INICIAL_MS = 5000;
const ESPERA_NOVA_TENTATIVA_MS = 10000;

export const tratarEvento = async (evento: AgnusEvent) => {
  if (evento.type === "produto.criado" || evento.type === "produto.atualizado") {
    await syncProdutoToSearchIndex(Number(evento.payload.id_produto));
  }

  if (evento.type === "produto.removido") {
    await removeProdutoFromSearchIndex(Number(evento.payload.id_produto));
  }

  if (evento.type.startsWith("categoria.") || evento.type === "vendas.atualizadas") {
    await syncAllProdutosToSearchIndex();
  }
};

// A reindexação periódica cobre eventos perdidos e o intervalo em que o catálogo ainda não subiu.
const reindexar = () =>
  syncAllProdutosToSearchIndex().catch((error) => {
    logger.warn("busca.falha_reindexar", { error: error instanceof Error ? error.message : String(error) });
    return false;
  });

// Na subida o catálogo pode ainda não estar pronto: insiste até a primeira carga do índice dar certo.
const primeiraCarga = async () => {
  if (!(await reindexar())) {
    setTimeout(() => void primeiraCarga(), ESPERA_NOVA_TENTATIVA_MS).unref();
  }
};

export const iniciarIndexacao = async () => {
  await initializeProdutoSearchIndex();
  await EventBusService.subscribe(tratarEvento);
  setTimeout(() => void primeiraCarga(), ESPERA_INICIAL_MS).unref();
  setInterval(() => void reindexar(), INTERVALO_RECONCILIACAO_MS).unref();
};
