import { Op } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import EventBusService from "@agnus/comum/services/eventBus.service";
import logger from "@agnus/comum/utils/logger";
import { AfiliadoCliques, Afiliados, ConversaoItens, Conversoes, type StatusConversao } from "../models";
import { config } from "../utils/config";
import { lerReferencia } from "../utils/seguranca";
import { produtosDoCatalogo } from "./catalogo.service";
import { calcularComissao, carregarRegras, dinheiro, statusPelaSituacaoDoPedido } from "./comissao.service";

const DIA_MS = 24 * 60 * 60 * 1000;

export type PedidoParaConversao = {
  id_pedido: number;
  id_usuario: number;
  status: string;
  ref: string | null;
  valor_total: number;
  data_pedido?: string | Date | null;
  itens: { id_produto: number; quantidade: number; subtotal: number }[];
};

export type ResultadoAtribuicao =
  | { atribuido: false; motivo: string }
  | { atribuido: true; id_conversao: number; status: StatusConversao; valor_comissao: number };

const naoAtribuido = (motivo: string): ResultadoAtribuicao => ({ atribuido: false, motivo });

// Completa os itens com categoria e nome (a taxa pode depender da categoria).
const itensComissionaveis = async (itens: PedidoParaConversao["itens"]) => {
  let catalogo: Awaited<ReturnType<typeof produtosDoCatalogo>> = [];

  try {
    catalogo = await produtosDoCatalogo();
  } catch (error) {
    // Sem o catálogo, a comissão sai pela regra do produto ou padrão (sem a de categoria).
    logger.warn("afiliados.catalogo_indisponivel", { error: error instanceof Error ? error.message : String(error) });
  }

  const porId = new Map(catalogo.map((produto) => [produto.id_produto, produto]));

  return itens.map((item) => {
    const produto = porId.get(Number(item.id_produto));
    return {
      id_produto: Number(item.id_produto),
      id_categoria: produto?.id_categoria ?? null,
      nome_produto: produto?.nome ?? null,
      quantidade: Number(item.quantidade) || 1,
      valor: dinheiro(Number(item.subtotal) || 0),
    };
  });
};

class ConversaoService {
  // Chamado pelo serviço de pedidos no checkout (e pela reconciliação). Idempotente por id_pedido.
  static async registrar(pedido: PedidoParaConversao): Promise<ResultadoAtribuicao> {
    const existente = await Conversoes.findOne({ where: { id_pedido: pedido.id_pedido } });

    if (existente) {
      await ConversaoService.atualizarStatus(pedido.id_pedido, pedido.status);
      return { atribuido: true, id_conversao: existente.id_conversao, status: existente.status, valor_comissao: Number(existente.valor_comissao) };
    }

    const referencia = lerReferencia(pedido.ref);
    if (!referencia) return naoAtribuido("sem_clique_valido");

    const clique = await AfiliadoCliques.findByPk(referencia.idClique);
    if (!clique) return naoAtribuido("clique_inexistente");

    const dataPedido = pedido.data_pedido ? new Date(pedido.data_pedido) : new Date();

    // Último clique dentro da janela (o cookie expira junto, mas conferimos também no servidor).
    if (dataPedido.getTime() - new Date(clique.data_criacao).getTime() > config.janelaDias() * DIA_MS) {
      return naoAtribuido("fora_da_janela");
    }

    const afiliado = await Afiliados.findByPk(clique.id_afiliado);
    if (!afiliado || afiliado.status !== "ativo") return naoAtribuido("afiliado_inativo");

    const calculo = calcularComissao(await itensComissionaveis(pedido.itens), await carregarRegras(), afiliado);
    // Autoindicação: a compra fica registrada (transparência), mas sem comissão.
    const autoindicacao = afiliado.id_usuario === pedido.id_usuario;
    const status: StatusConversao = autoindicacao ? "cancelada" : statusPelaSituacaoDoPedido(pedido.status);

    const conversao = await sequelize.transaction(async (transaction) => {
      const nova = await Conversoes.create(
        {
          id_pedido: pedido.id_pedido,
          id_afiliado: afiliado.id_afiliado,
          id_link: clique.id_link,
          id_clique: clique.id_clique,
          id_usuario_comprador: pedido.id_usuario,
          status,
          status_pedido: pedido.status,
          valor_pedido: dinheiro(Number(pedido.valor_total) || 0),
          valor_comissionavel: calculo.valor_comissionavel,
          valor_comissao: calculo.valor_comissao,
          motivo_cancelamento: autoindicacao ? "Compra feita pelo próprio afiliado" : status === "cancelada" ? "Pedido cancelado" : null,
          data_clique: clique.data_criacao,
          data_pedido: dataPedido,
        },
        { transaction },
      );

      await ConversaoItens.bulkCreate(
        calculo.itens.map((item) => ({ ...item, id_conversao: nova.id_conversao })),
        { transaction },
      );

      return nova;
    });

    await EventBusService.publish("afiliado.conversao", {
      id_pedido: pedido.id_pedido,
      id_usuario: pedido.id_usuario,
      id_afiliado: afiliado.id_afiliado,
      status,
      valor_comissao: calculo.valor_comissao,
    });
    logger.info("afiliados.conversao_registrada", {
      pedido: pedido.id_pedido,
      afiliado: afiliado.id_afiliado,
      status,
      valorComissao: calculo.valor_comissao,
    });

    if (pedido.status === "entregue" && !autoindicacao) {
      await ConversaoService.atualizarStatus(pedido.id_pedido, "entregue");
    }

    return { atribuido: true, id_conversao: conversao.id_conversao, status: conversao.status, valor_comissao: calculo.valor_comissao };
  }

  // Segue o status do pedido. Comissão paga não volta atrás; autoindicação continua cancelada.
  static async atualizarStatus(idPedido: number, statusPedido: string, agora = new Date()) {
    const conversao = await Conversoes.findOne({ where: { id_pedido: idPedido } });

    if (!conversao) {
      return null;
    }

    const alteracoes: Partial<Conversoes> = { status_pedido: statusPedido };
    const autoindicacao = conversao.status === "cancelada" && conversao.motivo_cancelamento !== "Pedido cancelado";

    if (conversao.status === "paga") {
      if (statusPedido === "cancelado") {
        logger.warn("afiliados.pedido_cancelado_com_comissao_paga", { pedido: idPedido, conversao: conversao.id_conversao });
      }
    } else if (!autoindicacao) {
      const novo = statusPelaSituacaoDoPedido(statusPedido);

      if (novo === "cancelada") {
        Object.assign(alteracoes, { status: "cancelada", motivo_cancelamento: "Pedido cancelado", liberada_em: null });
      } else if (conversao.status !== "aprovada") {
        alteracoes.status = novo;
      }

      if (statusPedido === "entregue" && !conversao.data_entrega) {
        alteracoes.data_entrega = agora;
        alteracoes.liberada_em = new Date(agora.getTime() + config.prazoAprovacaoDias() * DIA_MS);
      }
    }

    await conversao.update(alteracoes);

    if (conversao.status === "pendente" && conversao.liberada_em && conversao.liberada_em <= agora) {
      await ConversaoService.aprovarLiberadas(agora);
    }

    return conversao;
  }

  // Devolução do cliente (aviso do serviço de pedidos):
  // - aberta: segura a comissão (sem data de liberação) até a devolução terminar;
  // - encerrada (recusada ou cancelada): volta a contar o prazo a partir da entrega;
  // - reembolsada: desconta a comissão das peças devolvidas, item a item, com a taxa gravada na
  //   conversão; se nada sobrar, a comissão é cancelada.
  // Comissão já paga não é mexida (só registra no log para acerto manual).
  static async aplicarDevolucao(
    idPedido: number,
    evento: "aberta" | "encerrada" | "reembolsada",
    itensDevolvidos: { id_produto: number | null; valor: number }[],
    agora = new Date(),
  ) {
    const conversao = await Conversoes.findOne({ where: { id_pedido: idPedido }, include: [{ model: ConversaoItens, as: "itens" }] });

    if (!conversao || conversao.status === "cancelada") {
      return conversao;
    }

    if (conversao.status === "paga") {
      logger.warn("afiliados.devolucao_com_comissao_paga", { pedido: idPedido, conversao: conversao.id_conversao, evento });
      return conversao;
    }

    const liberacaoPelaEntrega = () =>
      conversao.data_entrega ? new Date(new Date(conversao.data_entrega).getTime() + config.prazoAprovacaoDias() * DIA_MS) : null;

    if (evento === "aberta") {
      await conversao.update({ status: "pendente", liberada_em: null, data_aprovacao: null });
      return conversao;
    }

    if (evento === "encerrada") {
      await conversao.update({ status: "pendente", liberada_em: liberacaoPelaEntrega() });
      await ConversaoService.aprovarLiberadas(agora);
      return conversao;
    }

    // reembolsada: taxa média por produto (o mesmo produto pode ter vindo em mais de uma linha).
    const taxaPorProduto = new Map<number, number>();
    for (const item of conversao.itens ?? []) {
      taxaPorProduto.set(item.id_produto, Number(item.taxa));
    }

    const desconto = dinheiro(
      itensDevolvidos.reduce((total, item) => {
        const taxa = item.id_produto == null ? 0 : (taxaPorProduto.get(Number(item.id_produto)) ?? 0);
        return total + (Number(item.valor) * taxa) / 100;
      }, 0),
    );
    const valorDevolvido = dinheiro(itensDevolvidos.reduce((total, item) => total + Number(item.valor), 0));
    const comissao = dinheiro(Math.max(0, Number(conversao.valor_comissao) - desconto));
    const comissionavel = dinheiro(Math.max(0, Number(conversao.valor_comissionavel) - valorDevolvido));

    if (comissao <= 0 || comissionavel <= 0) {
      await conversao.update({ status: "cancelada", valor_comissao: 0, valor_comissionavel: comissionavel, motivo_cancelamento: "Peças devolvidas", liberada_em: null });
    } else {
      await conversao.update({ status: "pendente", valor_comissao: comissao, valor_comissionavel: comissionavel, liberada_em: liberacaoPelaEntrega() });
      await ConversaoService.aprovarLiberadas(agora);
    }

    logger.info("afiliados.devolucao_aplicada", { pedido: idPedido, desconto, comissaoRestante: comissao });
    return conversao;
  }

  // Rotina periódica: pedido entregue há mais que o prazo de arrependimento -> comissão aprovada.
  static async aprovarLiberadas(agora = new Date()) {
    const [quantidade] = await Conversoes.update(
      { status: "aprovada", data_aprovacao: agora },
      { where: { status: "pendente", liberada_em: { [Op.lte]: agora } } },
    );

    if (quantidade > 0) {
      logger.info("afiliados.comissoes_aprovadas", { quantidade });
    }

    return quantidade;
  }
}

export default ConversaoService;
