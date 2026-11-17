import { Op, literal } from "sequelize";
import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import { consultarSelecoes } from "@agnus/comum/utils/itemDetails";
import logger from "@agnus/comum/utils/logger";
import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";

// Alguns dias depois da entrega o cliente recebe um e-mail pedindo para avaliar as peças. Cada
// pedido é pedido uma vez só (avaliacao_pedida_em); entregas antigas (mais de 30 dias) ficam de fora.
const DIA_MS = 24 * 60 * 60 * 1000;
const LIMITE_POR_RODADA = 50;
const JANELA_DIAS = 30;

export const diasParaPedirAvaliacao = () => {
  const dias = Number(process.env.DIAS_PARA_PEDIR_AVALIACAO ?? 3);
  return Number.isFinite(dias) && dias >= 0 ? dias : 3;
};

type ProdutoParaAvaliar = { id_produto: number; nome: string; foto: string | null };

export const produtosDoPedido = async (idPedido: number): Promise<ProdutoParaAvaliar[]> => {
  const itens = await PedidoItens.findAll({ where: { id_pedido: idPedido } });
  const selecoes = await consultarSelecoes(itens);
  const vistos = new Map<number, ProdutoParaAvaliar>();

  for (const selecao of selecoes) {
    const contexto = selecao?.contexto;
    if (contexto && !vistos.has(contexto.produto.id_produto)) {
      vistos.set(contexto.produto.id_produto, { id_produto: contexto.produto.id_produto, nome: contexto.produto.nome, foto: contexto.foto });
    }
  }

  return [...vistos.values()];
};

class PedirAvaliacaoService {
  static async pendentes(agora = new Date()) {
    const ate = new Date(agora.getTime() - diasParaPedirAvaliacao() * DIA_MS);
    const desde = new Date(agora.getTime() - JANELA_DIAS * DIA_MS);
    const entregaEm = literal("COALESCE(`data_entrega`, `data_alteracao`)");

    return Pedidos.findAll({
      where: {
        status: "entregue",
        avaliacao_pedida_em: null,
        [Op.and]: [sequelizeEntre(entregaEm, desde, ate)],
      },
      order: [["id_pedido", "ASC"]],
      limit: LIMITE_POR_RODADA,
    });
  }

  static async rodar(agora = new Date()) {
    const pedidos = await PedirAvaliacaoService.pendentes(agora);
    let enviados = 0;

    for (const pedido of pedidos) {
      try {
        const produtos = await produtosDoPedido(pedido.id_pedido);

        if (produtos.length) {
          await chamarServico("notificacoes", "/pedir-avaliacao", {
            method: "POST",
            body: { id_usuario: pedido.id_usuario, id_pedido: pedido.id_pedido, produtos },
            timeoutMs: 10000,
          });
          enviados += 1;
        }

        await pedido.update({ avaliacao_pedida_em: agora });
      } catch (error) {
        // Fica para a próxima rodada.
        logger.warn("avaliacao.pedido_falhou", { pedido: pedido.id_pedido, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return { verificados: pedidos.length, enviados };
  }
}

// COALESCE(data_entrega, data_alteracao) BETWEEN :desde AND :ate, montado com o Sequelize.
const sequelizeEntre = (coluna: ReturnType<typeof literal>, desde: Date, ate: Date) =>
  Pedidos.sequelize!.where(coluna, { [Op.between]: [desde, ate] });

export const iniciarPedidosDeAvaliacao = () => {
  const rodar = () =>
    PedirAvaliacaoService.rodar()
      .then((r) => r.verificados && logger.info("avaliacao.pedidos_enviados", r))
      .catch((error) => logger.warn("avaliacao.rodada_falhou", { error: error instanceof Error ? error.message : String(error) }));
  setTimeout(rodar, 90_000).unref();
  setInterval(rodar, 30 * 60_000).unref();
};

export default PedirAvaliacaoService;
