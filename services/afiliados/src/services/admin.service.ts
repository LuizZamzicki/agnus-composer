import { Op, QueryTypes, Transaction } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import EventBusService from "@agnus/comum/services/eventBus.service";
import { HttpError } from "@agnus/comum/types/http_error";
import { AfiliadoPagamentos, Afiliados, Conversoes, RegrasComissao, type StatusAfiliado, type TipoRegra } from "../models";
import { config } from "../utils/config";
import { serializarAfiliado } from "./afiliado.service";
import { dinheiro } from "./comissao.service";
import { paginacao } from "./relatorio.service";

const STATUS_AFILIADO: StatusAfiliado[] = ["pendente", "ativo", "suspenso", "recusado"];
const TIPOS_REGRA: TipoRegra[] = ["padrao", "categoria", "produto"];

const taxaValida = (valor: unknown) => {
  const taxa = Number(valor);
  if (valor === null || valor === "" || !Number.isFinite(taxa) || taxa < 0 || taxa > 90) {
    throw new HttpError(400, "A taxa deve ser um percentual entre 0 e 90.");
  }
  return Math.round(taxa * 100) / 100;
};

type Saldo = { id_afiliado: number; a_receber: number | string; conversoes: number | string };

const saldos = async (ids?: number[]) => {
  const linhas = await sequelize.query<Saldo>(
    `SELECT id_afiliado, SUM(valor_comissao) AS a_receber, COUNT(*) AS conversoes
       FROM afiliado_conversoes WHERE status = 'aprovada' ${ids ? "AND id_afiliado IN (:ids)" : ""}
      GROUP BY id_afiliado`,
    { replacements: ids ? { ids } : {}, type: QueryTypes.SELECT },
  );
  return new Map(linhas.map((l) => [Number(l.id_afiliado), { a_receber: dinheiro(Number(l.a_receber)), conversoes: Number(l.conversoes) }]));
};

class AdminService {
  static async listarAfiliados(query: Record<string, unknown>) {
    const { page, limit, offset } = paginacao(query, 50, 200);
    const status = STATUS_AFILIADO.includes(query.status as StatusAfiliado) ? (query.status as StatusAfiliado) : undefined;
    const { rows, count } = await Afiliados.findAndCountAll({
      where: status ? { status } : {},
      order: [["data_criacao", "DESC"]],
      limit,
      offset,
    });
    const porAfiliado = rows.length ? await saldos(rows.map((a) => a.id_afiliado)) : new Map();

    return {
      data: rows.map((a) => ({ ...serializarAfiliado(a), saldo: porAfiliado.get(a.id_afiliado) ?? { a_receber: 0, conversoes: 0 } })),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  }

  // Aprovar, suspender, recusar e combinar uma taxa própria com o afiliado (null = volta à regra da loja).
  static async atualizarAfiliado(idAfiliado: number, corpo: Record<string, unknown>) {
    const afiliado = await Afiliados.findByPk(idAfiliado);
    if (!afiliado) throw new HttpError(404, "Afiliado não encontrado.");

    const alteracoes: Partial<Afiliados> = {};

    if (corpo.status !== undefined) {
      if (!STATUS_AFILIADO.includes(corpo.status as StatusAfiliado)) {
        throw new HttpError(400, `status deve ser um de: ${STATUS_AFILIADO.join(", ")}.`);
      }
      alteracoes.status = corpo.status as StatusAfiliado;
    }

    if (corpo.taxa_personalizada !== undefined) {
      alteracoes.taxa_personalizada = corpo.taxa_personalizada === null ? null : taxaValida(corpo.taxa_personalizada);
    }

    await afiliado.update(alteracoes);
    return serializarAfiliado(afiliado);
  }

  static async listarRegras() {
    const regras = await RegrasComissao.findAll({ order: [["tipo", "ASC"], ["referencia_id", "ASC"]] });
    const padrao = regras.find((r) => r.tipo === "padrao");

    return {
      taxa_padrao_em_uso: padrao ? Number(padrao.taxa) : config.taxaPadrao(),
      prioridade: ["produto", "categoria", "afiliado (taxa_personalizada)", "padrao"],
      data: regras.map((r) => ({ id_regra: r.id_regra, tipo: r.tipo, referencia_id: r.tipo === "padrao" ? null : r.referencia_id, taxa: Number(r.taxa) })),
    };
  }

  // Cria ou troca a regra (uma por tipo + referência). Vale para as próximas conversões.
  static async salvarRegra(corpo: Record<string, unknown>) {
    const tipo = corpo.tipo as TipoRegra;
    if (!TIPOS_REGRA.includes(tipo)) throw new HttpError(400, `tipo deve ser um de: ${TIPOS_REGRA.join(", ")}.`);

    const referenciaId = tipo === "padrao" ? 0 : Number(corpo.referencia_id);
    if (tipo !== "padrao" && (!Number.isInteger(referenciaId) || referenciaId <= 0)) {
      throw new HttpError(400, `Informe referencia_id (id ${tipo === "categoria" ? "da categoria" : "do produto"}).`);
    }

    const taxa = taxaValida(corpo.taxa);
    const existente = await RegrasComissao.findOne({ where: { tipo, referencia_id: referenciaId } });
    const regra = existente ? await existente.update({ taxa }) : await RegrasComissao.create({ tipo, referencia_id: referenciaId, taxa });

    return { id_regra: regra.id_regra, tipo, referencia_id: tipo === "padrao" ? null : referenciaId, taxa };
  }

  static async removerRegra(idRegra: number) {
    const removidas = await RegrasComissao.destroy({ where: { id_regra: idRegra } });
    if (!removidas) throw new HttpError(404, "Regra não encontrada.");
  }

  static async saldos() {
    const porAfiliado = await saldos();
    const afiliados = porAfiliado.size
      ? await Afiliados.findAll({ where: { id_afiliado: { [Op.in]: [...porAfiliado.keys()] } } })
      : [];

    return {
      total_a_pagar: dinheiro([...porAfiliado.values()].reduce((t, s) => t + s.a_receber, 0)),
      data: afiliados.map((a) => ({
        id_afiliado: a.id_afiliado,
        nome_publico: a.nome_publico,
        chave_pix: a.chave_pix,
        ...porAfiliado.get(a.id_afiliado),
      })),
    };
  }

  // Fechamento: todas as comissões aprovadas do afiliado viram "paga" num único pagamento.
  // Trava as linhas (FOR UPDATE) para duas pessoas não pagarem a mesma comissão.
  static async registrarPagamento(idAfiliado: number, corpo: Record<string, unknown>, idUsuarioAdmin: number) {
    const pagamento = await AdminService.pagarNaTransacao(idAfiliado, corpo, idUsuarioAdmin);
    await EventBusService.publish("afiliado.pagamento", {
      id_afiliado: pagamento.id_afiliado,
      id_pagamento: pagamento.id_pagamento,
      valor: pagamento.valor,
      quantidade_conversoes: pagamento.quantidade_conversoes,
    });
    return pagamento;
  }

  private static async pagarNaTransacao(idAfiliado: number, corpo: Record<string, unknown>, idUsuarioAdmin: number) {
    return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
      const afiliado = await Afiliados.findByPk(idAfiliado, { transaction });
      if (!afiliado) throw new HttpError(404, "Afiliado não encontrado.");

      const aprovadas = await Conversoes.findAll({
        where: { id_afiliado: idAfiliado, status: "aprovada" },
        lock: transaction.LOCK.UPDATE,
        transaction,
      });

      if (aprovadas.length === 0) throw new HttpError(409, "Esse afiliado não tem comissão aprovada a pagar.");

      const valor = dinheiro(aprovadas.reduce((total, c) => total + Number(c.valor_comissao), 0));
      const pagamento = await AfiliadoPagamentos.create(
        {
          id_afiliado: idAfiliado,
          valor,
          quantidade_conversoes: aprovadas.length,
          referencia: typeof corpo.referencia === "string" ? corpo.referencia.trim().slice(0, 120) || null : null,
          observacao: typeof corpo.observacao === "string" ? corpo.observacao.trim().slice(0, 255) || null : null,
          id_usuario_admin: idUsuarioAdmin,
        },
        { transaction },
      );

      await Conversoes.update(
        { status: "paga", id_pagamento: pagamento.id_pagamento },
        { where: { id_conversao: { [Op.in]: aprovadas.map((c) => c.id_conversao) } }, transaction },
      );

      return { id_pagamento: pagamento.id_pagamento, id_afiliado: idAfiliado, valor, quantidade_conversoes: aprovadas.length, chave_pix: afiliado.chave_pix };
    });
  }

  static async listarPagamentos(query: Record<string, unknown>, idAfiliado?: number) {
    const { page, limit, offset } = paginacao(query, 50, 200);
    const filtro = idAfiliado ?? (query.id_afiliado ? Number(query.id_afiliado) : undefined);
    const { rows, count } = await AfiliadoPagamentos.findAndCountAll({
      where: filtro ? { id_afiliado: filtro } : {},
      order: [["data_criacao", "DESC"]],
      limit,
      offset,
    });

    return {
      data: rows.map((p) => ({
        id_pagamento: p.id_pagamento,
        id_afiliado: p.id_afiliado,
        valor: Number(p.valor),
        quantidade_conversoes: p.quantidade_conversoes,
        referencia: p.referencia,
        observacao: p.observacao,
        data_criacao: p.data_criacao,
      })),
      pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  }
}

export default AdminService;
