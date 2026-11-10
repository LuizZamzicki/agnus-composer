import sequelize from "@agnus/comum/config/database";
import EventBusService from "@agnus/comum/services/eventBus.service";
import type { AgnusEvent } from "@agnus/comum/types/event.types";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import ProdutoCores from "../models/ProdutoCores";
import ProdutoVendas from "../models/ProdutoVendas";

const ESPERA_AGRUPAMENTO_MS = 1000;
const ESPERA_NOVA_TENTATIVA_MS = 10000;
const INTERVALO_RECONCILIACAO_MS = 5 * 60 * 1000;

let agendamento: NodeJS.Timeout | null = null;

// O evento só avisa que algo mudou; o total é relido da fonte. Assim, um evento perdido no Pub/Sub
// se corrige sozinho na próxima atualização.
export const atualizarVendas = async () => {
  const { data: vendas } = await chamarServico<{ id_produto_cor: number; quantidade: number | string }[]>("pedidos", "/vendas");
  const cores = await ProdutoCores.findAll({
    where: { id_produto_cor: vendas.map((venda) => venda.id_produto_cor) },
    attributes: ["id_produto_cor", "id_produto"],
  });
  const produtoDaCor = new Map(cores.map((cor) => [cor.id_produto_cor, cor.id_produto]));
  const totais = new Map<number, number>();

  for (const venda of vendas) {
    const idProduto = produtoDaCor.get(venda.id_produto_cor);

    if (idProduto) {
      totais.set(idProduto, (totais.get(idProduto) ?? 0) + Number(venda.quantidade));
    }
  }

  await sequelize.transaction(async (transaction) => {
    await ProdutoVendas.destroy({ where: {}, transaction });
    await ProdutoVendas.bulkCreate(
      [...totais].map(([id_produto, quantidade_vendida]) => ({ id_produto, quantidade_vendida })),
      { transaction },
    );
  });

  await EventBusService.publish("vendas.atualizadas", { produtos: totais.size });
};

const atualizarComSeguranca = () =>
  atualizarVendas().then(
    () => true,
    (error) => {
      logger.warn("vendas.falha_ao_atualizar", { error: error instanceof Error ? error.message : String(error) });
      return false;
    },
  );

// Na subida o serviço de pedidos pode ainda não estar pronto.
const primeiraCarga = async () => {
  if (!(await atualizarComSeguranca())) {
    setTimeout(() => void primeiraCarga(), ESPERA_NOVA_TENTATIVA_MS).unref();
  }
};

const agendarAtualizacao = () => {
  if (agendamento) {
    return;
  }

  agendamento = setTimeout(() => {
    agendamento = null;
    void atualizarComSeguranca();
  }, ESPERA_AGRUPAMENTO_MS);
};

export const tratarEvento = (evento: AgnusEvent) => {
  if (evento.type.startsWith("pedido.")) {
    agendarAtualizacao();
  }
};

export const iniciarProjecaoDeVendas = async () => {
  await EventBusService.subscribe(tratarEvento);
  void primeiraCarga();
  setInterval(() => void atualizarComSeguranca(), INTERVALO_RECONCILIACAO_MS).unref();
};
