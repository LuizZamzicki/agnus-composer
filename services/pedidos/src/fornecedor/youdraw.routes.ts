import { Request, Response, Router } from "express";
import { PERMISSIONS } from "@agnus/comum/config/permissions";
import authenticateToken from "@agnus/comum/middlewares/auth.middleware";
import { checarPermissao } from "@agnus/comum/middlewares/permission.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import { configuracaoYouDraw, webhookYouDrawValido, type EventoWebhookYouDraw } from "@agnus/comum/utils/youdraw";
import YouDrawService, { PedidosFornecedor } from "./youdraw.service";

const router = Router();

const id = (valor: unknown) => {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "ID do pedido inválido.");
  return n;
};

// ---- Equipe: situação do pedido na YouDraw e reenvio ----
router.get("/orders/:id/fornecedor", authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_LISTAR), async (req: Request, res: Response) => {
  const registro = await PedidosFornecedor.findByPk(id(req.params.id));
  res.set("Cache-Control", "no-store");
  return res.json({ integracao_ativa: YouDrawService.ativa(), fornecedor: YouDrawService.resumo(registro) });
});

router.post("/orders/:id/fornecedor/enviar", authenticateToken, checarPermissao(PERMISSIONS.PEDIDO_ATUALIZAR), async (req: Request, res: Response) => {
  const registro = await YouDrawService.enviar(id(req.params.id), { novaChave: req.body?.nova_chave === true });
  return res.json({ integracao_ativa: YouDrawService.ativa(), fornecedor: YouDrawService.resumo(registro) });
});

// ---- Webhook da YouDraw ----
// Cadastro no painel deles: Menu da conta > API > Webhooks, URL https://<público>/youdraw/webhook,
// canal "api". Assinatura HMAC conferida; entrega repetida (mesmo X-YouDraw-Delivery) é ignorada.
const entregasVistas = new Set<string>();
const lembrarEntrega = (idEntrega: string) => {
  entregasVistas.add(idEntrega);
  if (entregasVistas.size > 2000) entregasVistas.delete(entregasVistas.values().next().value as string);
};

router.post("/youdraw/webhook", async (req: Request, res: Response) => {
  const segredo = configuracaoYouDraw()?.segredoWebhook;
  if (!segredo) {
    logger.warn("youdraw.webhook_ignorado_sem_segredo");
    return res.status(200).json({ ok: true, processado: false, motivo: "YOUDRAW_WEBHOOK_SECRET não configurado." });
  }

  const corpoBruto = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from("");
  const valido = webhookYouDrawValido(corpoBruto, req.header("x-youdraw-timestamp"), req.header("x-youdraw-signature"), segredo);
  if (!valido) {
    logger.warn("youdraw.webhook_assinatura_invalida", { evento: req.header("x-youdraw-event") });
    return res.status(401).json({ message: "Assinatura inválida." });
  }

  const idEntrega = req.header("x-youdraw-delivery") ?? "";
  if (idEntrega && entregasVistas.has(idEntrega)) return res.status(200).json({ ok: true, repetido: true });

  try {
    const resultado = await YouDrawService.aplicarEvento(req.body as EventoWebhookYouDraw);
    if (idEntrega) lembrarEntrega(idEntrega);
    logger.info("youdraw.webhook", { evento: req.header("x-youdraw-event"), ...resultado });
    return res.status(200).json({ ok: true, ...resultado });
  } catch (error) {
    // Não-2xx faz a YouDraw tentar de novo (até 8 vezes em 3 dias).
    logger.error("youdraw.webhook_falhou", { error: error instanceof Error ? error.message : String(error) });
    return res.status(500).json({ message: "Tente novamente." });
  }
});

export default router;
