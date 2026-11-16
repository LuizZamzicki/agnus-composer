import { Request, Response, Router } from "express";
import { Op, fn, col } from "sequelize";
import PedidoItens from "../models/PedidoItens";
import Pedidos from "../models/Pedidos";
import { dadosParaAfiliacao } from "../services/afiliacao.service";

const STATUS_DE_VENDA = ["pago", "enviado", "entregue"];
const router = Router();

const idsDe = (valor: unknown) => (Array.isArray(valor) ? (valor as number[]) : []);

router.post("/itens/contagem", async (req: Request, res: Response) => {
  const filtros = [
    ...(idsDe(req.body?.cores).length ? [{ id_produto_cor: { [Op.in]: idsDe(req.body.cores) } }] : []),
    ...(idsDe(req.body?.grades).length ? [{ id_produto_grade: { [Op.in]: idsDe(req.body.grades) } }] : []),
  ];
  const total = filtros.length ? await PedidoItens.count({ where: { [Op.or]: filtros } }) : 0;

  return res.status(200).json({ total });
});

router.post("/compras/entregues", async (req: Request, res: Response) => {
  const pedidos = await Pedidos.findAll({
    where: { id_usuario: Number(req.body?.id_usuario), status: "entregue" },
    attributes: ["id_pedido"],
  });
  const cores = idsDe(req.body?.cores);
  const itens = pedidos.length && cores.length
    ? await PedidoItens.count({ where: { id_pedido: pedidos.map((pedido) => pedido.id_pedido), id_produto_cor: cores } })
    : 0;

  return res.status(200).json({ comprou: itens > 0 });
});

router.get("/vinculos", async (req: Request, res: Response) => {
  const where = {
    ...(req.query.id_usuario ? { id_usuario: Number(req.query.id_usuario) } : {}),
    ...(req.query.id_usuario_endereco ? { id_usuario_endereco: Number(req.query.id_usuario_endereco) } : {}),
  };

  return res.status(200).json({ total: Object.keys(where).length ? await Pedidos.count({ where }) : 0 });
});

// Fonte do "mais vendidos": o catálogo monta a própria projeção a partir daqui.
router.get("/vendas", async (_req: Request, res: Response) => {
  const pedidos = await Pedidos.findAll({ where: { status: STATUS_DE_VENDA }, attributes: ["id_pedido"] });
  const vendas = pedidos.length
    ? await PedidoItens.findAll({
        where: { id_pedido: pedidos.map((pedido) => pedido.id_pedido) },
        attributes: ["id_produto_cor", [fn("SUM", col("quantidade")), "quantidade"]],
        group: ["id_produto_cor"],
        raw: true,
      })
    : [];

  return res.status(200).json(vendas);
});

// Reconciliação do programa de afiliados: pedidos recentes que chegaram com cookie de afiliado
// (para registrar conversões cujo aviso falhou) e o status atual dos pedidos informados.
router.post("/afiliados/sincronizar", async (req: Request, res: Response) => {
  const desde = new Date(String(req.body?.desde ?? ""));
  const ids = idsDe(req.body?.ids).filter((id) => Number.isInteger(id)).slice(0, 1000);

  if (Number.isNaN(desde.getTime())) {
    return res.status(400).json({ message: "Informe desde (data ISO)." });
  }

  const recentes = await Pedidos.findAll({
    where: { ref_afiliado: { [Op.ne]: null }, data_criacao: { [Op.gte]: desde } },
    order: [["id_pedido", "ASC"]],
    limit: 500,
  });
  const comStatus = ids.length
    ? await Pedidos.findAll({ where: { id_pedido: { [Op.in]: ids } }, attributes: ["id_pedido", "status"] })
    : [];

  const novos = [];
  for (const pedido of recentes) {
    novos.push(await dadosParaAfiliacao(pedido));
  }

  return res.status(200).json({
    novos,
    status: comStatus.map((pedido) => ({ id_pedido: pedido.id_pedido, status: pedido.status })),
  });
});

export default router;
