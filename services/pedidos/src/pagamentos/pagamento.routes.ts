import { Request, Response, Router } from "express";
import authenticateToken, { type AuthenticatedResponseLocals } from "@agnus/comum/middlewares/auth.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import { assinaturaValida, configuracaoMercadoPago } from "./mercadoPago";
import PagamentoService from "./pagamento.service";

type Resposta = Response<object, AuthenticatedResponseLocals>;

const router = Router();

const idDoPedido = (valor: unknown) => {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Número do pedido inválido.");
  }

  return id;
};

const comprador = (res: Resposta) => {
  const usuario = res.locals.authUser!;
  return { id_usuario: usuario.id_usuario, email: usuario.email };
};

// Pagamento é dado pessoal: nem o navegador nem um proxy guardam a resposta.
const semCache = (res: Resposta) => res.set("Cache-Control", "no-store");

// A chave pública é pública por definição: o formulário do Mercado Pago no navegador precisa dela.
router.get("/pagamentos/config", (_req: Request, res: Response) => {
  res.status(200).json(PagamentoService.configuracaoPublica());
});

router.post("/orders/:id/pagamento", authenticateToken, async (req: Request, res: Resposta) => {
  const resultado = await PagamentoService.iniciar(idDoPedido(req.params.id), comprador(res), req.body ?? {});
  return semCache(res).status(201).json(resultado);
});

router.get("/orders/:id/pagamento", authenticateToken, async (req: Request, res: Resposta) => {
  return semCache(res).status(200).json(await PagamentoService.consultar(idDoPedido(req.params.id), comprador(res)));
});

// Webhook do Mercado Pago. É opcional: sem MP_WEBHOOK_SECRET a rota responde 200 e não faz nada
// (sem assinatura não há como saber se veio do Mercado Pago); o status chega pela consulta da tela.
router.post("/pagamentos/webhook", async (req: Request, res: Response) => {
  const config = configuracaoMercadoPago();
  const corpo = (req.body ?? {}) as { type?: string; data?: { id?: string | number } };
  const tipo = String(req.query.type ?? req.query.topic ?? corpo.type ?? "");
  const dataId = String(req.query["data.id"] ?? req.query.id ?? corpo.data?.id ?? "");

  if (!config?.webhookSecret) {
    logger.warn("pagamento.webhook_ignorado_sem_segredo", { tipo });
    return res.status(200).json({ ok: true, processado: false, motivo: "Webhook sem MP_WEBHOOK_SECRET configurado." });
  }

  const valida = assinaturaValida(
    { assinatura: req.header("x-signature"), requestId: req.header("x-request-id"), dataId },
    config.webhookSecret,
  );

  if (!valida) {
    logger.warn("pagamento.webhook_assinatura_invalida", { tipo });
    return res.status(401).json({ message: "Assinatura inválida." });
  }

  if (tipo !== "payment" || !/^\d{1,20}$/.test(dataId)) {
    return res.status(200).json({ ok: true });
  }

  try {
    await PagamentoService.notificar(dataId);
  } catch (error) {
    // 500 faz o Mercado Pago tentar de novo mais tarde.
    logger.error("pagamento.webhook_falhou", { pagamento: dataId, error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: "Tente novamente." });
  }

  return res.status(200).json({ ok: true });
});

export default router;
