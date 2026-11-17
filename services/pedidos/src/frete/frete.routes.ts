import { Request, Response, Router } from "express";
import { HttpError } from "@agnus/comum/types/http_error";
import FreteService from "./frete.service";

const router = Router();

// Cotação pública (carrinho de visitante e página da peça). O valor das peças só decide se o
// frete é grátis na tela; no checkout o servidor refaz tudo com a sacola de verdade.
router.post("/frete/cotacao", async (req: Request, res: Response) => {
  try {
    const { cep, pecas, valor_pecas: valorPecas } = req.body ?? {};
    return res.status(200).json(await FreteService.cotar(cep, pecas, valorPecas));
  } catch (error) {
    if (error instanceof HttpError) return res.status(error.status).json({ message: error.message });
    throw error;
  }
});

export default router;
