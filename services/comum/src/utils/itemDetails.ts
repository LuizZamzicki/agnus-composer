import { chamarServico } from "./clienteInterno";

type ItemLike = {
  toJSON?: () => Record<string, unknown>;
  id_produto_cor: number;
  id_produto_grade: number;
  quantidade?: number | null;
};

type ProdutoResumo = { id_produto: number; nome: string; descricao: string | null; preco_base: number | string; ativo: boolean };
type CorResumo = { id_produto_cor: number; id_produto: number; nome: string; codigo_rgb: string; acrescimo: number | string };
type GradeResumo = { id_produto_grade: number; id_produto: number; nome: string; acrescimo: number | string };

export type ProdutoContext = {
  produto: ProdutoResumo;
  cor: CorResumo;
  grade: GradeResumo;
  foto: string | null;
  precoUnitario: number;
};

export type SelecaoProduto = {
  cor: CorResumo | null;
  grade: GradeResumo | null;
  contexto: ProdutoContext | null;
};

const parseMoney = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsedValue = Number(value);
  return Number.isNaN(parsedValue) ? 0 : parsedValue;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

const normalizeQuantidade = (value: unknown) => {
  const parsedValue = Number(value ?? 1);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return 1;
  }

  return Math.trunc(parsedValue);
};

// Preço, nome e foto pertencem ao catálogo: quem vende nunca lê as tabelas dele.
export const consultarSelecoes = async (pares: { id_produto_cor: number; id_produto_grade: number }[]) => {
  const { data } = await chamarServico<SelecaoProduto[]>("catalogo", "/produtos/selecoes", {
    method: "POST",
    body: { pares },
    repetivel: true,
  });

  return data;
};

export const consultarSelecao = async (idProdutoCor: number, idProdutoGrade: number) =>
  (await consultarSelecoes([{ id_produto_cor: idProdutoCor, id_produto_grade: idProdutoGrade }]))[0];

export const resolveProdutoContext = async (
  idProdutoCor: number,
  idProdutoGrade: number,
): Promise<ProdutoContext | null> => (await consultarSelecao(idProdutoCor, idProdutoGrade)).contexto;

export const enrichItemsWithProductData = async <T extends ItemLike>(items: T[]) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const selecoes = await consultarSelecoes(
    items.map((item) => ({
      id_produto_cor: Number(item.id_produto_cor),
      id_produto_grade: Number(item.id_produto_grade),
    })),
  );
  const enrichedItems = items.map((item, indice) => {
      const rawItem = typeof item.toJSON === "function" ? item.toJSON() : item;
      const produtoContext = selecoes[indice].contexto;

      if (!produtoContext) {
        return {
          ...rawItem,
          produto: null,
          cor: null,
          grade: null,
          foto_produto: null,
        };
      }

      const { produto, cor, grade, foto } = produtoContext;
      const quantidade = normalizeQuantidade(item.quantidade);
      const acrescimoCor = roundMoney(parseMoney(cor.acrescimo));
      const acrescimoGrade = roundMoney(parseMoney(grade.acrescimo));
      const precoBase = roundMoney(parseMoney(produto.preco_base));
      const precoUnitario = roundMoney(precoBase + acrescimoCor + acrescimoGrade);
      const subtotal = roundMoney(precoUnitario * quantidade);
      const fotoProduto = foto ?? null;

      return {
        ...rawItem,
        quantidade,
        preco_unitario: precoUnitario,
        subtotal,
        nome_produto: produto.nome,
        descricao_produto: produto.descricao,
        foto_produto: fotoProduto,
        produto: {
          id_produto: produto.id_produto,
          nome: produto.nome,
          descricao: produto.descricao,
          preco_base: precoBase,
          foto: fotoProduto,
        },
        cor: {
          id_produto_cor: cor.id_produto_cor,
          nome: cor.nome,
          codigo_rgb: cor.codigo_rgb,
          acrescimo: acrescimoCor,
        },
        grade: {
          id_produto_grade: grade.id_produto_grade,
          nome: grade.nome,
          acrescimo: acrescimoGrade,
        },
      };
    });

  return enrichedItems;
};

export const calculateSubtotal = (precoUnitario: number, quantidade: number) =>
  roundMoney(precoUnitario * normalizeQuantidade(quantidade));

export const normalizeItemQuantity = normalizeQuantidade;
