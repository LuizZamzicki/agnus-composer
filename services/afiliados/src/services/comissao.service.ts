import { RegrasComissao, type Afiliados, type OrigemTaxa, type StatusConversao } from "../models";
import { config } from "../utils/config";

export const dinheiro = (valor: number) => Math.round(valor * 100) / 100;

export type Regras = {
  padrao: number | null;
  porCategoria: Map<number, number>;
  porProduto: Map<number, number>;
};

export type ItemComissionavel = {
  id_produto: number;
  id_categoria: number | null;
  nome_produto: string | null;
  quantidade: number;
  valor: number;
};

export type ItemComComissao = ItemComissionavel & { taxa: number; origem_taxa: OrigemTaxa; valor_comissao: number };

export const carregarRegras = async (): Promise<Regras> => {
  const regras = await RegrasComissao.findAll();
  const regrasCompletas: Regras = { padrao: null, porCategoria: new Map(), porProduto: new Map() };

  for (const regra of regras) {
    const taxa = Number(regra.taxa);

    if (regra.tipo === "padrao") regrasCompletas.padrao = taxa;
    if (regra.tipo === "categoria") regrasCompletas.porCategoria.set(Number(regra.referencia_id), taxa);
    if (regra.tipo === "produto") regrasCompletas.porProduto.set(Number(regra.referencia_id), taxa);
  }

  return regrasCompletas;
};

// Ordem de prioridade (a mais específica ganha), como as comissões por item da Shopee:
// 1) regra do produto  2) regra da categoria  3) taxa combinada com o afiliado  4) taxa padrão da loja.
export const taxaDoItem = (
  item: Pick<ItemComissionavel, "id_produto" | "id_categoria">,
  regras: Regras,
  afiliado?: Pick<Afiliados, "taxa_personalizada"> | null,
): { taxa: number; origem_taxa: OrigemTaxa } => {
  const produto = regras.porProduto.get(item.id_produto);
  if (produto !== undefined) return { taxa: produto, origem_taxa: "produto" };

  const categoria = item.id_categoria == null ? undefined : regras.porCategoria.get(item.id_categoria);
  if (categoria !== undefined) return { taxa: categoria, origem_taxa: "categoria" };

  if (afiliado?.taxa_personalizada != null) return { taxa: Number(afiliado.taxa_personalizada), origem_taxa: "afiliado" };

  return { taxa: regras.padrao ?? config.taxaPadrao(), origem_taxa: "padrao" };
};

// A comissão incide só sobre o valor das peças (sem frete), item a item; a taxa usada fica gravada
// em cada item, então mudar a regra depois não altera comissões já registradas.
export const calcularComissao = (
  itens: ItemComissionavel[],
  regras: Regras,
  afiliado?: Pick<Afiliados, "taxa_personalizada"> | null,
) => {
  const comComissao: ItemComComissao[] = itens.map((item) => {
    const { taxa, origem_taxa } = taxaDoItem(item, regras, afiliado);
    return { ...item, taxa, origem_taxa, valor_comissao: dinheiro((item.valor * taxa) / 100) };
  });

  return {
    itens: comComissao,
    valor_comissionavel: dinheiro(comComissao.reduce((total, item) => total + item.valor, 0)),
    valor_comissao: dinheiro(comComissao.reduce((total, item) => total + item.valor_comissao, 0)),
  };
};

// Status do pedido -> status da comissão. "entregue" continua pendente até passar o prazo de
// arrependimento (liberada_em); quem aprova é a rotina periódica.
export const statusPelaSituacaoDoPedido = (statusPedido: string): StatusConversao => {
  switch (statusPedido) {
    case "pago":
    case "enviado":
    case "entregue":
      return "pendente";
    case "cancelado":
      return "cancelada";
    default:
      return "aguardando_pagamento";
  }
};
