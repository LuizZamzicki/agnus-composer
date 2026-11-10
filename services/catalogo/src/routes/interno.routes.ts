import { Request, Response, Router } from "express";
import { QueryTypes } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import ProdutoCores from "../models/ProdutoCores";
import ProdutoFotos from "../models/ProdutoFotos";
import ProdutoGrades from "../models/ProdutoGrades";
import Produtos from "../models/Produtos";

const router = Router();

const dinheiro = (valor: unknown) => Number(valor ?? 0) || 0;
const arredondar = (valor: number) => Number(valor.toFixed(2));

const fotoDoProduto = async (idProduto: number, idCor: number) => {
  const daCor = await ProdutoFotos.findOne({
    where: { id_produto: idProduto, id_produto_cor: idCor },
    order: [["id_produto_foto", "ASC"]],
  });
  const foto = daCor ?? (await ProdutoFotos.findOne({ where: { id_produto: idProduto }, order: [["id_produto_foto", "ASC"]] }));

  return foto?.caminho_url ?? null;
};

const resolverSelecao = async (idCor: number, idGrade: number) => {
  const cor = await ProdutoCores.findByPk(idCor);
  const grade = await ProdutoGrades.findByPk(idGrade);
  const produto = cor && grade && cor.id_produto === grade.id_produto ? await Produtos.findByPk(cor.id_produto) : null;

  if (!cor || !grade || !produto) {
    return { cor, grade, contexto: null };
  }

  return {
    cor,
    grade,
    contexto: {
      produto: {
        id_produto: produto.id_produto,
        nome: produto.nome,
        descricao: produto.descricao,
        preco_base: produto.preco_base,
        ativo: produto.ativo,
      },
      cor,
      grade,
      foto: await fotoDoProduto(produto.id_produto, cor.id_produto_cor),
      precoUnitario: arredondar(dinheiro(produto.preco_base) + dinheiro(cor.acrescimo) + dinheiro(grade.acrescimo)),
    },
  };
};

router.post("/produtos/selecoes", async (req: Request, res: Response) => {
  const pares = (req.body?.pares ?? []) as { id_produto_cor: number; id_produto_grade: number }[];

  return res.status(200).json(await Promise.all(pares.map((par) => resolverSelecao(par.id_produto_cor, par.id_produto_grade))));
});

const DOCUMENTOS_SQL = `
  SELECT p.id_produto, p.id_categoria, p.nome, COALESCE(p.descricao, '') AS descricao, p.preco_base, p.ativo,
    c.nome AS categoria_nome, COALESCE(v.quantidade_vendida, 0) AS quantidade_vendida,
    IFNULL(CONCAT('[',(SELECT GROUP_CONCAT(JSON_QUOTE(pf.caminho_url) ORDER BY pf.id_produto_foto ASC SEPARATOR ',')
      FROM produto_fotos pf WHERE pf.id_produto = p.id_produto),']'),'[]') AS imagens_json
  FROM produtos p
  LEFT JOIN categorias c ON c.id_categoria = p.id_categoria
  LEFT JOIN produto_vendas v ON v.id_produto = p.id_produto
`;

// Linhas prontas para o índice de busca, que não acessa este banco.
router.get("/produtos/documentos", async (req: Request, res: Response) => {
  const id = req.query.id === undefined ? undefined : Number(req.query.id);
  const linhas = await sequelize.query(id === undefined ? DOCUMENTOS_SQL : `${DOCUMENTOS_SQL} WHERE p.id_produto = :id`, {
    replacements: id === undefined ? undefined : { id },
    type: QueryTypes.SELECT,
  });

  return res.status(200).json(linhas);
});

router.get("/produtos/:id/cores", async (req: Request, res: Response) => {
  const idProduto = Number(req.params.id);

  if (!(await Produtos.findByPk(idProduto))) {
    return res.status(404).json({ message: "Produto não encontrado." });
  }

  const cores = await ProdutoCores.findAll({ where: { id_produto: idProduto }, attributes: ["id_produto_cor"] });

  return res.status(200).json({ cores: cores.map((cor) => cor.id_produto_cor) });
});

export default router;
