import { chamarServico } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import { consultarSelecoes } from "@agnus/comum/utils/itemDetails";
import PedidoItens from "../models/PedidoItens";
import type Pedidos from "../models/Pedidos";

export const COOKIE_AFILIADO = "agnus_afiliado";

// Lê o cookie de clique de afiliado do cabeçalho (o gateway entrega os cookies do site a todos os
// serviços). Quem confere a assinatura e a validade é o serviço afiliados.
export const refDoCookie = (cabecalho: string | undefined) => {
  if (!cabecalho) return null;

  for (const parte of cabecalho.split(";")) {
    const [nome, ...valor] = parte.trim().split("=");
    if (nome === COOKIE_AFILIADO) {
      const ref = decodeURIComponent(valor.join("="));
      return /^[\w.-]{5,200}$/.test(ref) ? ref : null;
    }
  }

  return null;
};

// Monta o que o serviço afiliados precisa para calcular a comissão (produto e valor de cada item).
export const dadosParaAfiliacao = async (pedido: Pedidos) => {
  const itens = await PedidoItens.findAll({ where: { id_pedido: pedido.id_pedido } });
  const selecoes = await consultarSelecoes(itens);

  return {
    id_pedido: pedido.id_pedido,
    id_usuario: pedido.id_usuario,
    status: pedido.status,
    ref: pedido.ref_afiliado,
    valor_total: Number(pedido.valor_total ?? 0),
    data_pedido: pedido.data_criacao,
    itens: itens
      .map((item, indice) => ({
        id_produto: selecoes[indice]?.contexto?.produto.id_produto ?? null,
        quantidade: Number(item.quantidade ?? 1),
        subtotal: Number(item.subtotal ?? 0),
      }))
      .filter((item): item is { id_produto: number; quantidade: number; subtotal: number } => item.id_produto !== null),
  };
};

// Avisos ao programa de afiliados. Falha só vai para o log: a compra nunca depende disso, e a
// reconciliação do serviço afiliados recupera o que se perder.
class AfiliacaoService {
  static async avisarCompra(pedido: Pedidos) {
    if (!pedido.ref_afiliado) return;

    try {
      await chamarServico("afiliados", "/conversoes", { method: "POST", body: await dadosParaAfiliacao(pedido), timeoutMs: 5000 });
    } catch (error) {
      logger.warn("afiliacao.falha_ao_avisar_compra", { pedido: pedido.id_pedido, error: error instanceof Error ? error.message : String(error) });
    }
  }

  static async avisarStatus(pedido: Pedidos) {
    if (!pedido.ref_afiliado) return;

    try {
      await chamarServico("afiliados", "/conversoes/status", {
        method: "POST",
        body: { id_pedido: pedido.id_pedido, status: pedido.status },
      });
    } catch (error) {
      logger.warn("afiliacao.falha_ao_avisar_status", { pedido: pedido.id_pedido, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

export default AfiliacaoService;
