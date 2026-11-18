import { Request, Response, Router } from "express";
import ConversaoService, { type PedidoParaConversao } from "../services/conversao.service";

const router = Router();

const pedidoValido = (corpo: Partial<PedidoParaConversao>) =>
  Number.isInteger(corpo.id_pedido) &&
  Number.isInteger(corpo.id_usuario) &&
  typeof corpo.status === "string" &&
  Array.isArray(corpo.itens);

// Serviço de pedidos avisa a compra (checkout) com o cookie de clique que veio do navegador.
router.post("/conversoes", async (req: Request, res: Response) => {
  if (!pedidoValido(req.body ?? {})) {
    return res.status(400).json({ message: "Pedido incompleto." });
  }

  return res.status(200).json(await ConversaoService.registrar(req.body as PedidoParaConversao));
});

// Serviço de pedidos avisa cada mudança de status (pago, enviado, entregue, cancelado).
router.post("/conversoes/status", async (req: Request, res: Response) => {
  const { id_pedido: idPedido, status } = req.body ?? {};

  if (!Number.isInteger(idPedido) || typeof status !== "string") {
    return res.status(400).json({ message: "Informe id_pedido e status." });
  }

  const conversao = await ConversaoService.atualizarStatus(idPedido, status);
  return res.status(200).json({ atualizada: Boolean(conversao), status: conversao?.status ?? null });
});

// Serviço de pedidos avisa a devolução: aberta, encerrada sem reembolso ou reembolsada.
router.post("/conversoes/devolucao", async (req: Request, res: Response) => {
  const { id_pedido: idPedido, evento, itens } = req.body ?? {};

  if (!Number.isInteger(idPedido) || !["aberta", "encerrada", "reembolsada"].includes(evento) || !Array.isArray(itens)) {
    return res.status(400).json({ message: "Informe id_pedido, evento e itens." });
  }

  const conversao = await ConversaoService.aplicarDevolucao(idPedido, evento, itens);
  return res.status(200).json({ atualizada: Boolean(conversao), status: conversao?.status ?? null, valor_comissao: conversao ? Number(conversao.valor_comissao) : null });
});

export default router;
