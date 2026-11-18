import { createHmac, timingSafeEqual } from "crypto";
import logger from "./logger";

// Cliente da API Comercial da YouDraw (v1, beta privada): https://docs.youdraw.com.br/
// Único ponto do sistema que conhece a API deles (camada anticorrupção), como mercadoPago.ts.
//
// Sem YOUDRAW_API_KEY a integração fica desligada e os pedidos são feitos à mão no painel.

const URL_PADRAO = "https://api.youdraw.com.br/api/v1";
const TIMEOUT_MS = 15000;
const JANELA_WEBHOOK_S = 5 * 60;

export type ConfigYouDraw = { chave: string; url: string; ambiente: "live" | "test"; segredoWebhook: string | null };

export const configuracaoYouDraw = (env: NodeJS.ProcessEnv = process.env): ConfigYouDraw | null => {
  const chave = (env.YOUDRAW_API_KEY ?? "").trim();
  if (!/^yd_(live|test)_[A-Za-z0-9_-]{8,}$/.test(chave)) return null;

  return {
    chave,
    url: (env.YOUDRAW_API_URL ?? URL_PADRAO).trim().replace(/\/+$/, ""),
    ambiente: chave.startsWith("yd_live_") ? "live" : "test",
    segredoWebhook: (env.YOUDRAW_WEBHOOK_SECRET ?? "").trim() || null,
  };
};

// ---------------- Tipos (schemas do openapi.yaml, versão 1.10.0-beta) ----------------
export type StatusPedidoYouDraw =
  | "awaiting_art"
  | "pending_payment"
  | "paid"
  | "in_production"
  | "shipped"
  | "delivered"
  | "returned"
  | "canceled"
  | "other";

export type EnderecoYouDraw = {
  postal_code: string;
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  state: string;
};

export type NovoPedidoYouDraw = {
  external_reference?: string | null;
  customer: { name: string; document: string; email?: string | null; phone?: string | null; address: EnderecoYouDraw };
  items: { sku: string; quantity: number; line_reference?: string }[];
  notes?: string | null;
};

export type EnvioYouDraw = {
  tracking_code: string;
  carrier: string | null;
  provider: string;
  tracking_url: string | null;
};

export type PedidoYouDraw = {
  id: string;
  number: number;
  public_code: string;
  channel: string;
  external_reference: string | null;
  status: StatusPedidoYouDraw;
  amounts: { subtotal_cents: number; shipping_cents: number; total_cents: number; currency: "BRL" };
  shipments: EnvioYouDraw[];
  created_at: string;
  paid_at: string | null;
};

export type VarianteYouDraw = {
  id: string;
  sku: string | null;
  color: { name: string | null; hex: string | null };
  size: string | null;
};

export type ProdutoResumoYouDraw = { id: string; external_reference: string | null; name: string; status: string };
export type ProdutoDetalheYouDraw = ProdutoResumoYouDraw & { variants: VarianteYouDraw[] };

export type EventoWebhookYouDraw = {
  id: string;
  type: "order.created" | "order.status_changed" | "order.tracking_updated" | "payment.paid" | "payment.expired" | "webhook.test";
  environment?: "live" | "test";
  created_at: string;
  data: {
    object: "order" | "webhook_endpoint";
    order?: PedidoYouDraw;
    previous_status?: StatusPedidoYouDraw | null;
    current_status?: StatusPedidoYouDraw;
    tracking?: EnvioYouDraw;
  };
};

// ---------------- Erros ----------------
// Pela documentação: repetir em 408, timeout, 429 e 5xx; não repetir em 400, 401, 403, 404 e 422.
export class ErroYouDraw extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    message: string,
    readonly requestId: string | null = null,
  ) {
    super(message);
  }

  get retentavel() {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

type Opcoes = { metodo?: "GET" | "POST"; corpo?: unknown; idempotencia?: string };

export const chamarYouDraw = async <T>(caminho: string, { metodo = "GET", corpo, idempotencia }: Opcoes = {}): Promise<T> => {
  const config = configuracaoYouDraw();
  if (!config) throw new ErroYouDraw(0, "nao_configurado", "Integração com a YouDraw não configurada (YOUDRAW_API_KEY).");

  let resposta: Response;
  try {
    resposta = await fetch(`${config.url}${caminho}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${config.chave}`,
        Accept: "application/json",
        ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(idempotencia ? { "Idempotency-Key": idempotencia } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn("youdraw.sem_resposta", { caminho, error: error instanceof Error ? error.message : String(error) });
    throw new ErroYouDraw(0, "sem_resposta", "A YouDraw não respondeu. Tente de novo em instantes.");
  }

  const dados = (await resposta.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string; request_id?: string } };

  if (!resposta.ok) {
    const erro = new ErroYouDraw(
      resposta.status,
      dados.error?.code ?? `http_${resposta.status}`,
      dados.error?.message ?? `Erro ${resposta.status} da YouDraw.`,
      dados.error?.request_id ?? resposta.headers.get("x-request-id"),
    );
    // Nunca registra o corpo enviado: tem CPF, e-mail e endereço do cliente.
    logger.error("youdraw.erro", { caminho, status: erro.status, codigo: erro.codigo, requestId: erro.requestId });
    throw erro;
  }

  return dados.data as T;
};

// ---------------- Operações usadas pela loja ----------------
export const criarPedidoYouDraw = (pedido: NovoPedidoYouDraw, idempotencia: string) =>
  chamarYouDraw<PedidoYouDraw>("/orders", { metodo: "POST", corpo: pedido, idempotencia });

export const buscarPedidoYouDraw = (id: string) => chamarYouDraw<PedidoYouDraw>(`/orders/${encodeURIComponent(id)}`);

export const listarProdutosYouDraw = (pagina = 1, busca = "") =>
  chamarYouDraw<ProdutoResumoYouDraw[]>(
    `/products?page=${pagina}&per_page=100${busca ? `&search=${encodeURIComponent(busca)}` : ""}`,
  );

export const buscarProdutoYouDraw = (id: string) => chamarYouDraw<ProdutoDetalheYouDraw>(`/products/${encodeURIComponent(id)}`);

// Assinatura do webhook: v1=<hex> = HMAC-SHA256(segredo, "<timestamp>.<corpo bruto>"); recusa mais de 5 min.
export const webhookYouDrawValido = (
  corpoBruto: Buffer | string,
  timestamp: string | undefined,
  assinatura: string | undefined,
  segredo: string,
  agoraS = Math.floor(Date.now() / 1000),
) => {
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(agoraS - ts) > JANELA_WEBHOOK_S) return false;

  const recebida = /^v1=([0-9a-f]{64})$/i.exec(assinatura ?? "")?.[1]?.toLowerCase();
  if (!recebida) return false;

  const corpo = Buffer.isBuffer(corpoBruto) ? corpoBruto : Buffer.from(corpoBruto);
  const esperada = createHmac("sha256", segredo).update(Buffer.concat([Buffer.from(`${ts}.`), corpo])).digest("hex");
  return timingSafeEqual(Buffer.from(recebida), Buffer.from(esperada));
};
