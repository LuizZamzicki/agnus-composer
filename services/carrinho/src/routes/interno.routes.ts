import { Request, Response, Router } from "express";
import CarrinhoItens from "../models/CarrinhoItens";
import Carrinhos from "../models/Carrinhos";

const router = Router();

router.get("/usuarios/:id/itens", async (req: Request, res: Response) => {
  const carrinhos = await Carrinhos.findAll({ where: { id_usuario: Number(req.params.id) } });
  const itens = await CarrinhoItens.findAll({ where: { id_carrinho: carrinhos.map((carrinho) => carrinho.id_carrinho) } });

  return res.status(200).json(itens);
});

// O número de linhas removidas é a confirmação do checkout: duas compras simultâneas não baixam o mesmo item.
router.post("/itens/baixar", async (req: Request, res: Response) => {
  const ids = (req.body?.ids ?? []) as number[];
  const removidos = await CarrinhoItens.destroy({ where: { id_carrinho_item: ids } });

  return res.status(200).json({ removidos });
});

export default router;
