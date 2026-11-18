import { Request, Response, Router } from "express";
import NotificacaoService from "../services/notificacao.service";

const router = Router();

router.post("/status-pedido", async (req: Request, res: Response) => {
  await NotificacaoService.avisarMudancaDeStatus(req.body);
  return res.status(204).send();
});

router.post("/devolucao", async (req: Request, res: Response) => {
  const corpo = req.body ?? {};

  if (!Number.isInteger(corpo.id_usuario) || !Number.isInteger(corpo.id_pedido) || typeof corpo.status !== "string") {
    return res.status(400).json({ message: "Aviso de devolução incompleto." });
  }

  await NotificacaoService.avisarDevolucao(corpo);
  return res.status(204).send();
});

export default router;
