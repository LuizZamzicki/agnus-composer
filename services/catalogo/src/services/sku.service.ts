import { DataTypes, Model, Op } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { HttpError } from "@agnus/comum/types/http_error";
import logger from "@agnus/comum/utils/logger";
import {
  buscarProdutoYouDraw,
  configuracaoYouDraw,
  ErroYouDraw,
  listarProdutosYouDraw,
  type ProdutoResumoYouDraw,
} from "@agnus/comum/utils/youdraw";
import ProdutoCores from "../models/ProdutoCores";
import ProdutoGrades from "../models/ProdutoGrades";
import Produtos from "../models/Produtos";

export class ProdutoSkus extends Model {
  declare id_produto_sku: number;
  declare id_produto: number;
  declare cor: string;
  declare tamanho: string;
  declare sku: string;
  declare fornecedor: string;
  declare id_produto_fornecedor: string | null;
}

ProdutoSkus.init(
  {
    id_produto_sku: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_produto: { type: DataTypes.INTEGER, allowNull: false },
    cor: { type: DataTypes.STRING(60), allowNull: false },
    tamanho: { type: DataTypes.STRING(60), allowNull: false },
    sku: { type: DataTypes.STRING(255), allowNull: false },
    fornecedor: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "youdraw" },
    id_produto_fornecedor: { type: DataTypes.STRING(64), allowNull: true },
  },
  { sequelize, tableName: "produto_skus", timestamps: false },
);

// Comparação de nomes de cor/tamanho/produto sem acento, caixa ou espaços extras.
export const normalizar = (texto: string | null | undefined) =>
  (texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const chave = (cor: string, tamanho: string) => `${normalizar(cor)}|${normalizar(tamanho)}`;

type Combinacao = { cor: string; tamanho: string; sku: string | null };

const combinacoesDoProduto = async (idProduto: number) => {
  const produto = await Produtos.findByPk(idProduto);
  if (!produto) throw new HttpError(404, "Produto não encontrado.");

  const [cores, grades, skus] = await Promise.all([
    ProdutoCores.findAll({ where: { id_produto: idProduto }, order: [["id_produto_cor", "ASC"]] }),
    ProdutoGrades.findAll({ where: { id_produto: idProduto }, order: [["id_produto_grade", "ASC"]] }),
    ProdutoSkus.findAll({ where: { id_produto: idProduto } }),
  ]);
  const porChave = new Map(skus.map((s) => [chave(s.cor, s.tamanho), s]));
  const nomesCores = [...new Set(cores.map((c) => c.nome))];
  const nomesGrades = [...new Set(grades.map((g) => g.nome))];

  const combinacoes: Combinacao[] = nomesCores.flatMap((cor) =>
    nomesGrades.map((tamanho) => ({ cor, tamanho, sku: porChave.get(chave(cor, tamanho))?.sku ?? null })),
  );

  return { produto, combinacoes, idFornecedor: skus.find((s) => s.id_produto_fornecedor)?.id_produto_fornecedor ?? null };
};

class SkuService {
  static async listar(idProduto: number) {
    const { produto, combinacoes, idFornecedor } = await combinacoesDoProduto(idProduto);
    return {
      id_produto: idProduto,
      nome: produto.nome,
      id_produto_fornecedor: idFornecedor,
      integracao_ativa: Boolean(configuracaoYouDraw()),
      combinacoes,
      faltando: combinacoes.filter((c) => !c.sku).length,
    };
  }

  // Grava os SKUs digitados no admin. SKU vazio remove a ligação daquela combinação.
  static async salvar(idProduto: number, corpo: Record<string, unknown>, idProdutoFornecedor: string | null = null) {
    const { combinacoes } = await combinacoesDoProduto(idProduto);
    const existentes = new Set(combinacoes.map((c) => chave(c.cor, c.tamanho)));
    const lista = Array.isArray(corpo.skus) ? (corpo.skus as { cor?: unknown; tamanho?: unknown; sku?: unknown }[]) : null;
    if (!lista) throw new HttpError(400, "Envie skus: [{ cor, tamanho, sku }].");

    const vistos = new Set<string>();
    for (const item of lista) {
      const cor = String(item.cor ?? "").trim();
      const tamanho = String(item.tamanho ?? "").trim();
      const sku = String(item.sku ?? "").trim();
      const k = chave(cor, tamanho);

      if (!existentes.has(k)) throw new HttpError(400, `O produto não tem a combinação ${cor} / ${tamanho}.`);
      if (vistos.has(k)) throw new HttpError(400, `Combinação repetida: ${cor} / ${tamanho}.`);
      if (sku.length > 255 || /\s/.test(sku)) throw new HttpError(400, `SKU inválido em ${cor} / ${tamanho} (sem espaços, até 255 caracteres).`);
      vistos.add(k);
    }

    // O mesmo SKU em duas combinações faria a YouDraw produzir a peça errada.
    const skus = lista.map((i) => String(i.sku ?? "").trim()).filter(Boolean);
    if (new Set(skus).size !== skus.length) throw new HttpError(400, "O mesmo SKU foi usado em mais de uma combinação.");

    await sequelize.transaction(async (transaction) => {
      for (const item of lista) {
        const cor = String(item.cor).trim();
        const tamanho = String(item.tamanho).trim();
        const sku = String(item.sku ?? "").trim();
        if (!sku) {
          await ProdutoSkus.destroy({ where: { id_produto: idProduto, cor, tamanho }, transaction });
          continue;
        }
        const atual = await ProdutoSkus.findOne({ where: { id_produto: idProduto, cor, tamanho }, transaction });
        if (atual) await atual.update({ sku, id_produto_fornecedor: idProdutoFornecedor ?? atual.id_produto_fornecedor }, { transaction });
        else await ProdutoSkus.create({ id_produto: idProduto, cor, tamanho, sku, id_produto_fornecedor: idProdutoFornecedor }, { transaction });
      }
    });

    return SkuService.listar(idProduto);
  }

  // Busca o produto na YouDraw (pelo nome ou pelo id informado) e liga as variantes pela cor e
  // pelo tamanho. Combinações sem par ficam para preencher à mão.
  static async importarDaYouDraw(idProduto: number, corpo: Record<string, unknown>) {
    if (!configuracaoYouDraw()) {
      throw new HttpError(409, "Integração com a YouDraw desligada: configure YOUDRAW_API_KEY.");
    }

    const { produto, combinacoes } = await combinacoesDoProduto(idProduto);
    let idYouDraw = typeof corpo.id_produto_fornecedor === "string" ? corpo.id_produto_fornecedor.trim() : "";

    try {
      if (!idYouDraw) {
        const candidatos = await listarProdutosYouDraw(1, produto.nome);
        const exato = candidatos.filter((c: ProdutoResumoYouDraw) => normalizar(c.name) === normalizar(produto.nome));
        if (exato.length !== 1) {
          return {
            associados: 0,
            precisa_escolher: true,
            mensagem: exato.length > 1 ? "Há mais de um produto com esse nome na YouDraw: escolha qual." : "Não achamos um produto com o mesmo nome na YouDraw: escolha qual é.",
            candidatos: candidatos.slice(0, 20).map((c) => ({ id: c.id, nome: c.name, status: c.status })),
          };
        }
        idYouDraw = exato[0].id;
      }

      const detalhe = await buscarProdutoYouDraw(idYouDraw);
      const porChave = new Map(
        detalhe.variants.filter((v) => v.sku).map((v) => [chave(v.color?.name ?? "", v.size ?? ""), v.sku as string]),
      );
      const encontrados = combinacoes.map((c) => ({ ...c, sku: porChave.get(chave(c.cor, c.tamanho)) ?? c.sku }));
      const novos = encontrados.filter((c) => porChave.has(chave(c.cor, c.tamanho)));

      if (novos.length) {
        await SkuService.salvar(idProduto, { skus: encontrados.filter((c) => c.sku).map(({ cor, tamanho, sku }) => ({ cor, tamanho, sku })) }, detalhe.id);
      }

      logger.info("catalogo.skus_importados", { produto: idProduto, youdraw: detalhe.id, associados: novos.length });
      return {
        associados: novos.length,
        produto_youdraw: { id: detalhe.id, nome: detalhe.name },
        sem_par: encontrados.filter((c) => !porChave.has(chave(c.cor, c.tamanho))).map(({ cor, tamanho }) => ({ cor, tamanho })),
        variantes_youdraw: detalhe.variants.map((v) => ({ cor: v.color?.name ?? null, tamanho: v.size, sku: v.sku })),
        resumo: await SkuService.listar(idProduto),
      };
    } catch (error) {
      if (error instanceof ErroYouDraw) {
        throw new HttpError(error.status === 404 ? 404 : 502, `YouDraw: ${error.message}`);
      }
      throw error;
    }
  }

  // Rota interna (pedidos): SKU de cada par cor + grade do pedido; null quando não está ligado.
  static async resolverPares(pares: { id_produto_cor: number; id_produto_grade: number }[]) {
    const idsCores = [...new Set(pares.map((p) => Number(p.id_produto_cor)))];
    const idsGrades = [...new Set(pares.map((p) => Number(p.id_produto_grade)))];
    const [cores, grades] = await Promise.all([
      ProdutoCores.findAll({ where: { id_produto_cor: { [Op.in]: idsCores } } }),
      ProdutoGrades.findAll({ where: { id_produto_grade: { [Op.in]: idsGrades } } }),
    ]);
    const corPorId = new Map(cores.map((c) => [c.id_produto_cor, c]));
    const gradePorId = new Map(grades.map((g) => [g.id_produto_grade, g]));
    const idsProdutos = [...new Set(cores.map((c) => c.id_produto))];
    const skus = idsProdutos.length ? await ProdutoSkus.findAll({ where: { id_produto: { [Op.in]: idsProdutos } } }) : [];
    const skuPor = new Map(skus.map((s) => [`${s.id_produto}|${chave(s.cor, s.tamanho)}`, s.sku]));

    return pares.map((par) => {
      const cor = corPorId.get(Number(par.id_produto_cor));
      const grade = gradePorId.get(Number(par.id_produto_grade));
      if (!cor || !grade) return { ...par, id_produto: null, cor: null, tamanho: null, sku: null };
      return {
        ...par,
        id_produto: cor.id_produto,
        cor: cor.nome,
        tamanho: grade.nome,
        sku: skuPor.get(`${cor.id_produto}|${chave(cor.nome, grade.nome)}`) ?? null,
      };
    });
  }
}

export default SkuService;
