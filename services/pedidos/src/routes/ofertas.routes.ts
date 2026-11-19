import { Request, Response, Router } from "express";
import authenticateToken from "@agnus/comum/middlewares/auth.middleware";
import { HttpError } from "@agnus/comum/types/http_error";
import OfertasService, { DESCONTO_PRIMEIRA_COMPRA } from "../services/ofertas.service";

const router = Router();

const responderErro = (res: Response, error: unknown) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }
  throw error;
};

// Regra que o site mostra (desconto da primeira compra).
router.get("/ofertas/regras", (_req: Request, res: Response) => {
  res.set("Cache-Control", "public, max-age=300");
  return res.status(200).json({ desconto_primeira_compra: DESCONTO_PRIMEIRA_COMPRA });
});

// Inscrição pública (campo da página inicial). Devolve o cupom para já aparecer na tela; o
// mesmo código vai por e-mail com o link para cancelar.
router.post("/ofertas", async (req: Request, res: Response) => {
  try {
    const { inscricao, nova } = await OfertasService.inscrever(req.body?.email, "home");
    return res.status(nova ? 201 : 200).json({ cupom: inscricao.cupom_codigo, percentual: DESCONTO_PRIMEIRA_COMPRA, ja_inscrito: !nova });
  } catch (error) {
    return responderErro(res, error);
  }
});

router.post("/ofertas/cancelar", async (req: Request, res: Response) => {
  try {
    return res.status(200).json(await OfertasService.cancelar(req.body?.token));
  } catch (error) {
    return responderErro(res, error);
  }
});

// Confere o cupom antes de fechar o pedido (a mesma regra roda de novo no checkout).
router.get("/cupons/:codigo", authenticateToken, async (req: Request, res: Response) => {
  try {
    const cupom = await OfertasService.validarCupom(Number(res.locals.authUser.id_usuario), req.params.codigo);
    return res.status(200).json(cupom);
  } catch (error) {
    return responderErro(res, error);
  }
});

export default router;
