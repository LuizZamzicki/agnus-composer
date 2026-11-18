import { Op, QueryTypes, type WhereOptions } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { HttpError } from "@agnus/comum/types/http_error";
import { AfiliadoLinks, Afiliados, ConversaoItens, Conversoes, type StatusConversao } from "../models";
import { dinheiro } from "./comissao.service";

const STATUS: StatusConversao[] = ["aguardando_pagamento", "pendente", "aprovada", "cancelada", "paga"];
const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_PERIODO_DIAS = 93;

export const paginacao = (query: Record<string, unknown>, padrao = 20, maximo = 100) => {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(maximo, Math.max(1, Math.floor(Number(query.limit) || padrao)));
  return { page, limit, offset: (page - 1) * limit };
};

const meta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page * limit < total,
});

// Período como na Shopee: datas (YYYY-MM-DD) de início e fim, no máximo ~3 meses; padrão = últimos 30 dias.
export const periodo = (query: Record<string, unknown>) => {
  const data = (valor: unknown, fimDoDia: boolean) => {
    if (valor === undefined || valor === "") return null;
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new HttpError(400, "Datas no formato AAAA-MM-DD.");
    const d = new Date(`${valor}T${fimDoDia ? "23:59:59.999" : "00:00:00.000"}-03:00`);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, "Data inválida.");
    return d;
  };

  const fim = data(query.fim, true) ?? new Date();
  const inicio = data(query.inicio, false) ?? new Date(fim.getTime() - 30 * DIA_MS);

  if (inicio > fim) throw new HttpError(400, "A data de início é depois da data de fim.");
  if (fim.getTime() - inicio.getTime() > MAX_PERIODO_DIAS * DIA_MS) throw new HttpError(400, `Período máximo de ${MAX_PERIODO_DIAS} dias.`);

  return { inicio, fim };
};

const statusDoFiltro = (valor: unknown) => {
  if (valor === undefined || valor === "") return undefined;
  if (typeof valor !== "string" || !STATUS.includes(valor as StatusConversao)) {
    throw new HttpError(400, `status deve ser um de: ${STATUS.join(", ")}.`);
  }
  return valor as StatusConversao;
};

export const serializarConversao = (conversao: Conversoes, incluirComprador = false) => ({
  id_conversao: conversao.id_conversao,
  id_pedido: conversao.id_pedido,
  status: conversao.status,
  status_pedido: conversao.status_pedido,
  valor_pedido: Number(conversao.valor_pedido),
  valor_comissionavel: Number(conversao.valor_comissionavel),
  valor_comissao: Number(conversao.valor_comissao),
  motivo_cancelamento: conversao.motivo_cancelamento,
  data_clique: conversao.data_clique,
  data_pedido: conversao.data_pedido,
  data_entrega: conversao.data_entrega,
  liberada_em: conversao.liberada_em,
  data_aprovacao: conversao.data_aprovacao,
  id_pagamento: conversao.id_pagamento,
  ...(incluirComprador ? { id_afiliado: conversao.id_afiliado, id_usuario_comprador: conversao.id_usuario_comprador } : {}),
  link: conversao.link
    ? {
        slug: conversao.link.slug,
        destino: conversao.link.destino,
        sub_ids: [conversao.link.sub_id1, conversao.link.sub_id2, conversao.link.sub_id3, conversao.link.sub_id4, conversao.link.sub_id5].filter(Boolean),
      }
    : null,
  itens: (conversao.itens ?? []).map((item) => ({
    id_produto: item.id_produto,
    id_categoria: item.id_categoria,
    nome_produto: item.nome_produto,
    quantidade: item.quantidade,
    valor: Number(item.valor),
    taxa: Number(item.taxa),
    origem_taxa: item.origem_taxa,
    valor_comissao: Number(item.valor_comissao),
  })),
});

const somaPorStatus = async (where: WhereOptions) => {
  const linhas = (await Conversoes.findAll({
    where,
    attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id_conversao")), "quantidade"], [sequelize.fn("SUM", sequelize.col("valor_comissao")), "comissao"]],
    group: ["status"],
    raw: true,
  })) as unknown as { status: StatusConversao; quantidade: number | string; comissao: number | string | null }[];

  return Object.fromEntries(
    STATUS.map((status) => {
      const linha = linhas.find((l) => l.status === status);
      return [status, { quantidade: Number(linha?.quantidade ?? 0), comissao: dinheiro(Number(linha?.comissao ?? 0)) }];
    }),
  ) as Record<StatusConversao, { quantidade: number; comissao: number }>;
};

class RelatorioService {
  // conversionReport: todas as conversões do período (pela data do pedido), com itens e sub_ids.
  static async conversoes(filtro: { id_afiliado?: number }, query: Record<string, unknown>, incluirComprador = false) {
    const { inicio, fim } = periodo(query);
    const status = statusDoFiltro(query.status);
    const { page, limit, offset } = paginacao(query);
    const where: WhereOptions = {
      ...(filtro.id_afiliado ? { id_afiliado: filtro.id_afiliado } : {}),
      data_pedido: { [Op.between]: [inicio, fim] },
      ...(status ? { status } : {}),
    };

    const { rows, count } = await Conversoes.findAndCountAll({
      where,
      include: [
        { model: ConversaoItens, as: "itens" },
        { model: AfiliadoLinks, as: "link" },
      ],
      order: [["data_pedido", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    return {
      periodo: { inicio, fim },
      resumo: await somaPorStatus(where),
      data: rows.map((conversao) => serializarConversao(conversao, incluirComprador)),
      pagination: meta(page, limit, count),
    };
  }

  // validatedReport: comissões validadas (aprovadas ou pagas) no mês, que entram no fechamento.
  static async validadas(afiliado: Afiliados, query: Record<string, unknown>) {
    const mes = typeof query.mes === "string" && /^\d{4}-\d{2}$/.test(query.mes) ? query.mes : new Date().toISOString().slice(0, 7);
    const inicio = new Date(`${mes}-01T00:00:00.000-03:00`);
    const fim = new Date(inicio);
    fim.setMonth(fim.getMonth() + 1);

    const conversoes = await Conversoes.findAll({
      where: {
        id_afiliado: afiliado.id_afiliado,
        status: { [Op.in]: ["aprovada", "paga"] },
        data_aprovacao: { [Op.gte]: inicio, [Op.lt]: fim },
      },
      include: [{ model: ConversaoItens, as: "itens" }, { model: AfiliadoLinks, as: "link" }],
      order: [["data_aprovacao", "ASC"]],
    });

    return {
      mes,
      quantidade: conversoes.length,
      total_comissao: dinheiro(conversoes.reduce((total, c) => total + Number(c.valor_comissao), 0)),
      total_pago: dinheiro(conversoes.filter((c) => c.status === "paga").reduce((total, c) => total + Number(c.valor_comissao), 0)),
      data: conversoes.map((c) => serializarConversao(c)),
    };
  }

  // Cliques agrupados por dia, por link ou pelo sub_id1 (o "canal" que o afiliado marcou no link).
  static async cliques(afiliado: Afiliados, query: Record<string, unknown>) {
    const { inicio, fim } = periodo(query);
    const agrupar = query.agrupar === "link" || query.agrupar === "sub_id" ? query.agrupar : "dia";
    const chave = {
      dia: "DATE(CONVERT_TZ(c.data_criacao, '+00:00', '-03:00'))",
      link: "l.slug",
      sub_id: "COALESCE(l.sub_id1, '')",
    }[agrupar];

    const linhas = await sequelize.query<{ chave: string; cliques: number | string; visitantes: number | string }>(
      `SELECT ${chave} AS chave, COUNT(*) AS cliques, COUNT(DISTINCT c.ip_hash) AS visitantes
         FROM afiliado_cliques c JOIN afiliado_links l ON l.id_link = c.id_link
        WHERE c.id_afiliado = :id AND c.data_criacao BETWEEN :inicio AND :fim
        GROUP BY chave ORDER BY ${agrupar === "dia" ? "chave ASC" : "cliques DESC"} LIMIT 500`,
      { replacements: { id: afiliado.id_afiliado, inicio, fim }, type: QueryTypes.SELECT },
    );

    return {
      periodo: { inicio, fim },
      agrupar,
      data: linhas.map((l) => ({ chave: String(l.chave), cliques: Number(l.cliques), visitantes: Number(l.visitantes) })),
    };
  }

  static async resumo(afiliado: Afiliados) {
    const trintaDias = new Date(Date.now() - 30 * DIA_MS);
    const [cliques] = await sequelize.query<{ total: number | string }>(
      "SELECT COUNT(*) AS total FROM afiliado_cliques WHERE id_afiliado = :id AND data_criacao >= :desde",
      { replacements: { id: afiliado.id_afiliado, desde: trintaDias }, type: QueryTypes.SELECT },
    );
    const porStatus = await somaPorStatus({ id_afiliado: afiliado.id_afiliado });

    return {
      cliques_30_dias: Number(cliques?.total ?? 0),
      comissao: {
        aguardando_pagamento_do_pedido: porStatus.aguardando_pagamento,
        pendente: porStatus.pendente,
        a_receber: porStatus.aprovada,
        recebida: porStatus.paga,
        cancelada: porStatus.cancelada,
      },
    };
  }
}

export default RelatorioService;
