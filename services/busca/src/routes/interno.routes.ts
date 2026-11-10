import { Request, Response, Router } from "express";
import { searchProdutosInIndex } from "../services/produtoSearchIndex.service";

const router = Router();

router.post("/buscar", async (req: Request, res: Response) => {
  const resultado = await searchProdutosInIndex(req.body);

  return resultado ? res.status(200).json(resultado) : res.status(503).json({ message: "Busca indisponível." });
});

export default router;
