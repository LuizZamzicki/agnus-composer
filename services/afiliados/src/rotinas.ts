import { Op } from "sequelize";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import { Conversoes } from "./models";
import ConversaoService, { type PedidoParaConversao } from "./services/conversao.service";

const INTERVALO_MS = 10 * 60 * 1000;
const JANELA_RECONCILIACAO_MS = 3 * 24 * 60 * 60 * 1000;

type RespostaSincronizacao = {
  novos: PedidoParaConversao[];
  status: { id_pedido: number; status: string }[];
};

// O serviço de pedidos avisa na hora (checkout e mudança de status), mas uma chamada pode falhar.
// A cada 10 min: (1) pedidos recentes com cookie de afiliado que ainda não viraram conversão e
// (2) o status atual dos pedidos das conversões em aberto.
export const reconciliar = async () => {
  const abertas = await Conversoes.findAll({
    where: { status: { [Op.in]: ["aguardando_pagamento", "pendente"] } },
    attributes: ["id_pedido"],
    limit: 1000,
  });

  const { data } = await chamarServico<RespostaSincronizacao>("pedidos", "/afiliados/sincronizar", {
    method: "POST",
    timeoutMs: 15000,
    body: {
      desde: new Date(Date.now() - JANELA_RECONCILIACAO_MS).toISOString(),
      ids: abertas.map((c) => c.id_pedido),
    },
  });

  for (const pedido of data.novos) {
    await ConversaoService.registrar(pedido);
  }

  for (const { id_pedido: idPedido, status } of data.status) {
    await ConversaoService.atualizarStatus(idPedido, status);
  }
};

const rodar = async () => {
  try {
    await reconciliar();
  } catch (error) {
    logger.warn("afiliados.reconciliacao_falhou", { error: error instanceof Error ? error.message : String(error) });
  }

  try {
    await ConversaoService.aprovarLiberadas();
  } catch (error) {
    logger.error("afiliados.aprovacao_falhou", { error: error instanceof Error ? error.message : String(error) });
  }
};

export const iniciarRotinas = () => {
  setTimeout(() => void rodar(), 30000).unref();
  setInterval(() => void rodar(), INTERVALO_MS).unref();
  logger.info("afiliados.rotinas_iniciadas", { intervaloMs: INTERVALO_MS });
};
