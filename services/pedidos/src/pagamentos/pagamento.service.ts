import { randomUUID } from "crypto";
import EventBusService from "@agnus/comum/services/eventBus.service";
import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import Pagamentos from "../models/Pagamentos";
import Pedidos from "../models/Pedidos";
import AvisoPedidoService from "../services/avisoPedido.service";
import { DESCONTO_PIX, valorNoPix } from "../services/ofertas.regras";
import type { PedidoStatus } from "../types/pedido.types";
import {
  buscarPagamento,
  configuracaoMercadoPago,
  criarPagamento,
  statusDoPedido,
  type PagamentoMercadoPago,
} from "./mercadoPago";

// Dados que o formulário do Mercado Pago (Payment Brick) entrega no onSubmit. O valor que vier
// daqui é ignorado: o que se cobra é sempre o total gravado no pedido.
export type DadosDoFormulario = {
  token?: unknown;
  issuer_id?: unknown;
  payment_method_id?: unknown;
  installments?: unknown;
  payer?: {
    email?: unknown;
    first_name?: unknown;
    last_name?: unknown;
    identification?: { type?: unknown; number?: unknown };
  };
};

type Comprador = { id_usuario: number; email: string };

const MAX_PARCELAS = 12;
// Depois disso uma consulta pergunta de novo ao Mercado Pago (o webhook não chega em localhost).
const INTERVALO_ATUALIZACAO_MS = 5000;

const centavos = (valor: unknown) => Math.round(Number(valor) * 100);
const texto = (valor: unknown) => (typeof valor === "string" ? valor.trim() : "");

const totalDoPedido = (pedido: Pedidos) => (centavos(pedido.valor_total) + centavos(pedido.valor_frete ?? 0)) / 100;

const pixJaDescontado = (pedido: Pedidos) => centavos(pedido.valor_desconto_pix ?? 0) > 0;

// O que se cobra por meio de pagamento: no Pix, o total com o desconto do Pix (uma vez só: depois
// de aprovado, o desconto já está no valor_total do pedido).
export const valorACobrar = (pedido: Pedidos, metodo: string) =>
  metodo === "pix" && !pixJaDescontado(pedido) ? valorNoPix(totalDoPedido(pedido)) : totalDoPedido(pedido);

const pedidoDoComprador = async (idPedido: number, comprador: Comprador) => {
  const pedido = await Pedidos.findByPk(idPedido);

  // 404 também para pedido de outra pessoa: não revela que o número existe.
  if (!pedido || pedido.id_usuario !== comprador.id_usuario) {
    throw new HttpError(404, "Pedido não encontrado.");
  }

  return pedido;
};

const montarPagador = (dados: DadosDoFormulario, comprador: Comprador) => {
  const email = texto(dados.payer?.email);
  const tipoDocumento = texto(dados.payer?.identification?.type).toUpperCase();
  const numeroDocumento = texto(dados.payer?.identification?.number).replace(/\D/g, "");

  return {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : comprador.email,
    ...(texto(dados.payer?.first_name) ? { first_name: texto(dados.payer?.first_name).slice(0, 60) } : {}),
    ...(texto(dados.payer?.last_name) ? { last_name: texto(dados.payer?.last_name).slice(0, 60) } : {}),
    ...((tipoDocumento === "CPF" || tipoDocumento === "CNPJ") && /^\d{11,14}$/.test(numeroDocumento)
      ? { identification: { type: tipoDocumento, number: numeroDocumento } }
      : {}),
  };
};

// Só PIX e cartão: os dois meios oferecidos no formulário.
const montarMeio = (dados: DadosDoFormulario) => {
  const metodo = texto(dados.payment_method_id).toLowerCase();

  if (!/^[a-z_]{2,30}$/.test(metodo)) {
    throw new HttpError(400, "Escolha uma forma de pagamento.");
  }

  if (metodo === "pix") {
    return { payment_method_id: "pix" };
  }

  const token = texto(dados.token);
  const parcelas = Number(dados.installments ?? 1);
  const emissor = texto(String(dados.issuer_id ?? ""));

  if (!/^[\w-]{8,128}$/.test(token)) {
    throw new HttpError(400, "Os dados do cartão não chegaram. Preencha o cartão de novo.");
  }

  if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > MAX_PARCELAS) {
    throw new HttpError(400, `Escolha de 1 a ${MAX_PARCELAS} parcelas.`);
  }

  return {
    payment_method_id: metodo,
    token,
    installments: parcelas,
    ...(/^\d{1,12}$/.test(emissor) ? { issuer_id: Number(emissor) } : {}),
  };
};

const resumo = (pagamento: Pagamentos | null) =>
  pagamento && {
    status: pagamento.status,
    status_detalhe: pagamento.status_detalhe,
    metodo: pagamento.metodo,
    valor: Number(pagamento.valor),
    parcelas: pagamento.parcelas,
    pix:
      pagamento.metodo === "pix" && pagamento.pix_copia_e_cola
        ? {
            copia_e_cola: pagamento.pix_copia_e_cola,
            qr_code_base64: pagamento.pix_qr_code_base64,
            expira_em: pagamento.pix_expira_em,
          }
        : null,
  };

const pixValido = (pagamento: Pagamentos) =>
  pagamento.metodo === "pix" &&
  pagamento.status === "pending" &&
  Boolean(pagamento.pix_copia_e_cola) &&
  (!pagamento.pix_expira_em || new Date(pagamento.pix_expira_em).getTime() > Date.now() + 60_000);

class PagamentoService {
  static configuracaoPublica() {
    const config = configuracaoMercadoPago();
    return { ativo: Boolean(config), publicKey: config?.publicKey ?? null, desconto_pix: DESCONTO_PIX };
  }

  /**
   * Grava o que o Mercado Pago disse sobre um pagamento e, se for o caso, muda o status do pedido.
   * Só marca como pago quando a referência, o valor e a moeda batem com o pedido.
   */
  static async aplicar(pedido: Pedidos, mp: PagamentoMercadoPago) {
    if (String(mp.external_reference ?? "") !== String(pedido.id_pedido)) {
      logger.error("pagamento.referencia_diferente", { pedido: pedido.id_pedido, pagamento: mp.id });
      throw new HttpError(409, "O pagamento não pertence a este pedido.");
    }

    const dados = mp.point_of_interaction?.transaction_data;
    const valores = {
      id_pedido: pedido.id_pedido,
      mp_payment_id: String(mp.id),
      metodo: mp.payment_method_id,
      status: mp.status,
      status_detalhe: mp.status_detail,
      valor: mp.transaction_amount,
      parcelas: mp.installments,
      pix_copia_e_cola: dados?.qr_code ?? null,
      pix_qr_code_base64: dados?.qr_code_base64 ?? null,
      pix_expira_em: mp.date_of_expiration ? new Date(mp.date_of_expiration) : null,
    };

    const existente = await Pagamentos.findOne({ where: { mp_payment_id: valores.mp_payment_id } });
    const pagamento = existente ? await existente.update(valores) : await Pagamentos.create(valores);

    const novoStatus = statusDoPedido(mp.status);
    const esperado = valorACobrar(pedido, mp.payment_method_id);
    // Um Pix gerado antes do desconto existir (valor cheio) também vale: só não ganha o desconto.
    const valorConfere =
      mp.currency_id === "BRL" &&
      (centavos(mp.transaction_amount) === centavos(esperado) ||
        (mp.payment_method_id === "pix" && centavos(mp.transaction_amount) === centavos(totalDoPedido(pedido))));

    if (novoStatus === "pago" && !valorConfere) {
      logger.error("pagamento.valor_diferente", {
        pedido: pedido.id_pedido,
        pagamento: mp.id,
        cobrado: mp.transaction_amount,
        esperado,
      });
      return pagamento;
    }

    const podeMudar =
      (novoStatus === "pago" && pedido.status === "aguardando_pagamento") ||
      (novoStatus === "cancelado" && pedido.status === "pago");

    if (novoStatus && podeMudar) {
      const anterior: PedidoStatus = pedido.status;
      // Pago no Pix: o desconto passa a fazer parte do pedido (total, comissão e devolução seguem o que foi pago).
      const descontoPix =
        novoStatus === "pago" && mp.payment_method_id === "pix" && !pixJaDescontado(pedido)
          ? (centavos(totalDoPedido(pedido)) - centavos(mp.transaction_amount)) / 100
          : 0;
      await pedido.update({
        status: novoStatus,
        data_alteracao: new Date(),
        ...(descontoPix > 0
          ? { valor_desconto_pix: descontoPix, valor_total: (centavos(pedido.valor_total) - centavos(descontoPix)) / 100 }
          : {}),
      });
      await AvisoPedidoService.avisarMudancaDeStatus(pedido, anterior);
      await EventBusService.publish("pedido.atualizado", {
        id_pedido: pedido.id_pedido,
        id_usuario: pedido.id_usuario,
        status_anterior: anterior,
        status: novoStatus,
      });
      logger.info("pagamento.pedido_atualizado", { pedido: pedido.id_pedido, de: anterior, para: novoStatus });
    }

    return pagamento;
  }

  static async iniciar(idPedido: number, comprador: Comprador, dados: DadosDoFormulario) {
    const config = configuracaoMercadoPago();

    if (!config) {
      throw new HttpError(503, "O pagamento pelo site ainda não foi configurado.");
    }

    const pedido = await pedidoDoComprador(idPedido, comprador);

    if (pedido.status !== "aguardando_pagamento") {
      throw new HttpError(409, pedido.status === "pago" ? "Este pedido já está pago." : "Este pedido não está aguardando pagamento.");
    }

    const meio = montarMeio(dados);
    const total = valorACobrar(pedido, meio.payment_method_id);

    if (!(total > 0)) {
      throw new HttpError(409, "O pedido não tem valor a pagar.");
    }

    // Um PIX ainda válido do mesmo pedido é reaproveitado, em vez de gerar outra cobrança.
    if (meio.payment_method_id === "pix") {
      const pixAberto = await Pagamentos.findOne({
        where: { id_pedido: pedido.id_pedido, metodo: "pix", status: "pending" },
        order: [["id_pagamento", "DESC"]],
      });

      // Só reaproveita se o valor ainda é o de agora (ex.: não é um Pix de antes do desconto).
      if (pixAberto && pixValido(pixAberto) && centavos(pixAberto.valor) === centavos(total)) {
        return { id_pedido: pedido.id_pedido, status_pedido: pedido.status, pagamento: resumo(pixAberto) };
      }
    }

    const mp = await criarPagamento(
      {
        transaction_amount: total,
        description: `Pedido nº ${pedido.id_pedido} - Agnus`,
        external_reference: String(pedido.id_pedido),
        statement_descriptor: "AGNUS",
        ...(config.urlNotificacao ? { notification_url: config.urlNotificacao } : {}),
        metadata: { id_pedido: pedido.id_pedido },
        payer: montarPagador(dados, comprador),
        ...meio,
      },
      randomUUID(),
    );

    const pagamento = await PagamentoService.aplicar(pedido, mp);
    logger.info("pagamento.criado", { pedido: pedido.id_pedido, metodo: mp.payment_method_id, status: mp.status });

    return { id_pedido: pedido.id_pedido, status_pedido: pedido.status, pagamento: resumo(pagamento) };
  }

  static async consultar(idPedido: number, comprador: Comprador) {
    const pedido = await pedidoDoComprador(idPedido, comprador);
    let pagamento = await Pagamentos.findOne({ where: { id_pedido: pedido.id_pedido }, order: [["id_pagamento", "DESC"]] });

    // Sem webhook (ex.: em localhost), a própria consulta confere o pagamento pendente.
    const pendente = pagamento && ["pending", "in_process", "authorized"].includes(pagamento.status);
    const desatualizado =
      pagamento && Date.now() - new Date(pagamento.data_alteracao).getTime() > INTERVALO_ATUALIZACAO_MS;

    if (pagamento && pendente && desatualizado && configuracaoMercadoPago()) {
      try {
        pagamento = await PagamentoService.aplicar(pedido, await buscarPagamento(pagamento.mp_payment_id));
      } catch (error) {
        logger.warn("pagamento.consulta_falhou", { pedido: pedido.id_pedido, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return {
      id_pedido: pedido.id_pedido,
      status_pedido: pedido.status,
      total: totalDoPedido(pedido),
      total_pix: valorACobrar(pedido, "pix"),
      pagamento: resumo(pagamento),
    };
  }

  /** Notificação do Mercado Pago: o corpo só diz o id; a verdade vem sempre da API deles. */
  static async notificar(idPagamento: string) {
    const mp = await buscarPagamento(idPagamento);
    const idPedido = Number(mp.external_reference);
    const pedido = Number.isInteger(idPedido) && idPedido > 0 ? await Pedidos.findByPk(idPedido) : null;

    if (!pedido) {
      logger.warn("pagamento.webhook_sem_pedido", { pagamento: mp.id });
      return;
    }

    await PagamentoService.aplicar(pedido, mp);
  }
}

export default PagamentoService;
