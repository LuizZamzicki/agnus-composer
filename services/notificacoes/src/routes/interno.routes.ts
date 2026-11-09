import { Request, Response, Router } from "express";
import NotificacaoService from "../services/notificacao.service";

const router = Router();

router.post("/status-pedido", async (req: Request, res: Response) => {
  await NotificacaoService.avisarMudancaDeStatus(req.body);
  return res.status(204).send();
});

export default router;
