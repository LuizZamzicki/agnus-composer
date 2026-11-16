import Notificacoes from "../models/Notificacoes";
import logger from "@agnus/comum/utils/logger";
import RegistroService from "../registro/registro.service";
import AvisoPorEmailService, { avisarDevolucaoPorEmail, dispararSemEsperar } from "../email/avisoPorEmail.service";
import { conteudoDaDevolucao, type AvisoDevolucao } from "../email/modelos";

type PedidoStatus = "aguardando_calculo_frete" | "aguardando_pagamento" | "pago" | "enviado" | "entregue" | "cancelado";
type PedidoAvisado = { id_usuario: number; id_pedido: number; status: PedidoStatus; valor_total?: number | string | null };

const AVISOS_DE_STATUS: Partial<Record<PedidoStatus, { titulo: string; mensagem: (pedido: number) => string }>> = {
  aguardando_pagamento: {
    titulo: "Pedido aguardando pagamento",
    mensagem: (pedido) => `O pedido #${pedido} já pode ser pago.`,
  },
  pago: {
    titulo: "Pagamento confirmado",
    mensagem: (pedido) => `Recebemos o pagamento do pedido #${pedido}. Suas peças entram em produção.`,
  },
  enviado: {
    titulo: "Pedido enviado",
    mensagem: (pedido) => `O pedido #${pedido} saiu para entrega.`,
  },
  entregue: {
    titulo: "Pedido entregue",
    mensagem: (pedido) => `O pedido #${pedido} foi entregue. Conte como foram as peças.`,
  },
  cancelado: {
    titulo: "Pedido cancelado",
    mensagem: (pedido) => `O pedido #${pedido} foi cancelado.`,
  },
};

class NotificacaoService {
  // Cada etapa da devolução: aviso no site (sino) e e-mail ao cliente.
  static async avisarDevolucao(aviso: AvisoDevolucao & { id_usuario: number }) {
    const conteudo = conteudoDaDevolucao(aviso);

    if (!conteudo) {
      return;
    }

    const ref = { id_pedido: aviso.id_pedido, id_usuario: aviso.id_usuario, id_devolucao: aviso.id_devolucao };
    await RegistroService.registrar({
      ...ref,
      tipo: `devolucao.${aviso.status}`,
      categoria: "devolucao",
      descricao: `Devolução #${aviso.id_devolucao} do pedido #${aviso.id_pedido}: ${conteudo.titulo.toLowerCase()}`,
      dados: { ...aviso },
    });

    try {
      await Notificacoes.create({
        id_usuario: aviso.id_usuario,
        id_pedido: aviso.id_pedido,
        titulo: conteudo.titulo,
        mensagem: conteudo.mensagem.slice(0, 255),
      });
      await RegistroService.registrar({ ...ref, tipo: "aviso.site", categoria: "aviso", descricao: `Aviso no site ao cliente: "${conteudo.titulo}"`, dados: { titulo: conteudo.titulo } });
    } catch (error) {
      logger.error("notificacao.falha_ao_gravar", { pedido: aviso.id_pedido, devolucao: aviso.id_devolucao, error });
      await RegistroService.registrar({ ...ref, tipo: "aviso.site", categoria: "aviso", resultado: "falha", descricao: `Falha ao gravar o aviso no site: "${conteudo.titulo}"` });
    }

    dispararSemEsperar(avisarDevolucaoPorEmail(aviso), { devolucao: aviso.id_devolucao, status: aviso.status });
  }

  static async avisarMudancaDeStatus(pedido: PedidoAvisado) {
    const aviso = AVISOS_DE_STATUS[pedido.status];

    if (!aviso) {
      return;
    }

    const ref = { id_pedido: pedido.id_pedido, id_usuario: pedido.id_usuario };

    try {
      await Notificacoes.create({
        id_usuario: pedido.id_usuario,
        id_pedido: pedido.id_pedido,
        titulo: aviso.titulo,
        mensagem: aviso.mensagem(pedido.id_pedido),
      });
      await RegistroService.registrar({ ...ref, tipo: "aviso.site", categoria: "aviso", descricao: `Aviso no site ao cliente: "${aviso.titulo}"`, dados: { titulo: aviso.titulo, status: pedido.status } });
    } catch (error) {
      logger.error("notificacao.falha_ao_gravar", { pedido: pedido.id_pedido, error });
      await RegistroService.registrar({ ...ref, tipo: "aviso.site", categoria: "aviso", resultado: "falha", descricao: `Falha ao gravar o aviso no site: "${aviso.titulo}"` });
    }

    // O e-mail vai mesmo se o aviso no site falhar: são canais independentes.
    const valorTotal = pedido.valor_total == null || Number.isNaN(Number(pedido.valor_total)) ? null : Number(pedido.valor_total);
    dispararSemEsperar(AvisoPorEmailService.statusDoPedido({ ...pedido, valor_total: valorTotal }), { pedido: pedido.id_pedido, status: pedido.status });
  }
}

export default NotificacaoService;
