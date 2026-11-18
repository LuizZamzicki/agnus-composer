import { createHmac, timingSafeEqual } from "crypto";
import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import type { PedidoStatus } from "../types/pedido.types";

// Camada anticorrupção do Mercado Pago: só este arquivo conhece a API e os status deles.

const API = "https://api.mercadopago.com";
const TIMEOUT_MS = 15000;
// Tolerância do relógio para o carimbo de tempo do webhook (evita reaproveitar uma notificação antiga).
const JANELA_WEBHOOK_MS = 10 * 60 * 1000;

export type ConfiguracaoMercadoPago = {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  urlNotificacao: string | null;
};

const limpar = (valor: string | undefined) => (valor ?? "").trim();

export const lerConfiguracaoMercadoPago = (env: NodeJS.ProcessEnv = process.env): ConfiguracaoMercadoPago | null => {
  const accessToken = limpar(env.MP_ACCESS_TOKEN);
  const publicKey = limpar(env.MP_PUBLIC_KEY);

  if (!accessToken || !publicKey) {
    return null;
  }

  return {
    accessToken,
    publicKey,
    webhookSecret: limpar(env.MP_WEBHOOK_SECRET),
    // O Mercado Pago só aceita https público; em localhost, sem isto, o status vem pela consulta.
    urlNotificacao: limpar(env.MP_NOTIFICATION_URL) || null,
  };
};

let configuracao: ConfiguracaoMercadoPago | null | undefined;

export const configuracaoMercadoPago = () => {
  configuracao ??= lerConfiguracaoMercadoPago();
  return configuracao;
};

// Os testes trocam a configuração sem mexer em process.env.
export const definirConfiguracaoMercadoPago = (nova: ConfiguracaoMercadoPago | null | undefined) => {
  configuracao = nova;
};

export type PagamentoMercadoPago = {
  id: number;
  status: string;
  status_detail: string | null;
  payment_method_id: string;
  payment_type_id: string;
  transaction_amount: number;
  currency_id: string;
  installments: number | null;
  external_reference: string | null;
  date_of_expiration: string | null;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string };
  };
};

const indisponivel = () => new HttpError(503, "O pagamento está indisponível no momento. Tente novamente em instantes.");

const exigirConfiguracao = () => {
  const config = configuracaoMercadoPago();

  if (!config) {
    throw new HttpError(503, "O pagamento pelo site ainda não foi configurado.");
  }

  return config;
};

type ErroMercadoPago = { message?: string; error?: string; cause?: { code?: string | number; description?: string }[] };

const chamar = async <T>(caminho: string, init: RequestInit & { idempotencia?: string } = {}): Promise<T> => {
  const config = exigirConfiguracao();
  let resposta: Response;

  try {
    resposta = await fetch(`${API}${caminho}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.accessToken}`,
        ...(init.idempotencia ? { "X-Idempotency-Key": init.idempotencia } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    logger.error("mercadopago.sem_resposta", { caminho, error: error instanceof Error ? error.message : String(error) });
    throw indisponivel();
  }

  const corpo = (await resposta.json().catch(() => ({}))) as T & ErroMercadoPago;

  if (!resposta.ok) {
    // Nunca registra o corpo enviado: ele pode ter o token do cartão.
    logger.error("mercadopago.erro", {
      caminho,
      status: resposta.status,
      mensagem: corpo.message ?? corpo.error,
      causas: (corpo.cause ?? []).map((causa) => causa.code ?? causa.description),
    });

    // 401/403: credencial errada ou de ambiente trocado (ex.: comprador real com credencial de
    // teste). É configuração da loja, não erro do cliente.
    if (resposta.status === 401 || resposta.status === 403) {
      logger.error("mercadopago.credencial_recusada", {
        caminho,
        dica: "Confira MP_ACCESS_TOKEN; com credenciais de teste, o pagador precisa ser um usuário de teste comprador.",
      });
      throw indisponivel();
    }

    // Demais 4xx do Mercado Pago: dado inválido do formulário (cartão, CPF, e-mail).
    if (resposta.status >= 400 && resposta.status < 500) {
      throw new HttpError(400, "O Mercado Pago recusou os dados do pagamento. Confira e tente de novo.");
    }

    throw indisponivel();
  }

  return corpo;
};

export const criarPagamento = (corpo: Record<string, unknown>, idempotencia: string) =>
  chamar<PagamentoMercadoPago>("/v1/payments", { method: "POST", body: JSON.stringify(corpo), idempotencia });

export const buscarPagamento = (id: string) =>
  chamar<PagamentoMercadoPago>(`/v1/payments/${encodeURIComponent(id)}`, { method: "GET" });

export type ReembolsoMercadoPago = { id: number | string; status: string; amount: number };

// Reembolso total ou parcial (amount) de um pagamento aprovado. A chave de idempotência evita
// devolver o dinheiro duas vezes se a mesma devolução for reenviada.
export const criarReembolso = (idPagamento: string, valor: number, idempotencia: string) =>
  chamar<ReembolsoMercadoPago>(`/v1/payments/${encodeURIComponent(idPagamento)}/refunds`, {
    method: "POST",
    body: JSON.stringify({ amount: Math.round(valor * 100) / 100 }),
    idempotencia,
  });

/**
 * Tradução do status do Mercado Pago para o pedido. null = o pedido continua como está
 * (aguardando pagamento: o cliente pode tentar de novo).
 */
export const statusDoPedido = (statusMercadoPago: string): PedidoStatus | null => {
  switch (statusMercadoPago) {
    case "approved":
      return "pago";
    case "refunded":
    case "charged_back":
      return "cancelado";
    default:
      // pending, in_process, authorized, in_mediation, rejected, cancelled
      return null;
  }
};

/**
 * Assinatura do webhook (cabeçalho x-signature: "ts=...,v1=..."). O Mercado Pago assina
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com HMAC-SHA256 e a chave secreta do webhook.
 */
export const assinaturaValida = (
  { assinatura, requestId, dataId }: { assinatura?: string; requestId?: string; dataId?: string },
  segredo: string,
  agora = Date.now(),
) => {
  if (!segredo || !assinatura || !dataId) {
    return false;
  }

  const partes = Object.fromEntries(
    assinatura.split(",").map((parte) => {
      const [chave, ...valor] = parte.split("=");
      return [chave.trim(), valor.join("=").trim()];
    }),
  );
  const ts = partes.ts;
  const v1 = partes.v1;

  if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) {
    return false;
  }

  // ts vem em milissegundos; aceita também segundos, por segurança.
  const instante = Number(ts) < 1e12 ? Number(ts) * 1000 : Number(ts);

  if (!Number.isFinite(instante) || Math.abs(agora - instante) > JANELA_WEBHOOK_MS) {
    return false;
  }

  // IDs alfanuméricos chegam em minúsculas no manifesto.
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifesto = `id:${id};${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  const esperado = Buffer.from(createHmac("sha256", segredo).update(manifesto).digest("hex"));
  const recebido = Buffer.from(v1.toLowerCase());

  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido);
};
