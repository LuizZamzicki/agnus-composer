import { DataTypes, Model, Op, type WhereOptions } from "sequelize";
import sequelize from "@agnus/comum/config/database";
import { HttpError } from "@agnus/comum/types/http_error";
import type { AgnusEvent } from "@agnus/comum/types/event.types";
import logger from "@agnus/comum/utils/logger";

export type Categoria = "pedido" | "pagamento" | "devolucao" | "email" | "aviso" | "catalogo" | "usuario" | "afiliado" | "fornecedor" | "sistema";
export type Resultado = "sucesso" | "falha" | "ignorado";

export class RegistroEventos extends Model {
  declare id_registro: number;
  declare event_id: string | null;
  declare tipo: string;
  declare categoria: Categoria;
  declare descricao: string;
  declare resultado: Resultado;
  declare id_pedido: number | null;
  declare id_usuario: number | null;
  declare id_devolucao: number | null;
  declare origem: string | null;
  declare request_id: string | null;
  declare dados: Record<string, unknown> | null;
  declare ocorrido_em: Date;
  declare registrado_em: Date;
}

RegistroEventos.init(
  {
    id_registro: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    event_id: { type: DataTypes.STRING(36), allowNull: true },
    tipo: { type: DataTypes.STRING(60), allowNull: false },
    categoria: {
      type: DataTypes.ENUM("pedido", "pagamento", "devolucao", "email", "aviso", "catalogo", "usuario", "afiliado", "fornecedor", "sistema"),
      allowNull: false,
    },
    descricao: { type: DataTypes.STRING(255), allowNull: false },
    resultado: { type: DataTypes.ENUM("sucesso", "falha", "ignorado"), allowNull: false, defaultValue: "sucesso" },
    id_pedido: { type: DataTypes.INTEGER, allowNull: true },
    id_usuario: { type: DataTypes.INTEGER, allowNull: true },
    id_devolucao: { type: DataTypes.INTEGER, allowNull: true },
    origem: { type: DataTypes.STRING(40), allowNull: true },
    request_id: { type: DataTypes.STRING(64), allowNull: true },
    dados: { type: DataTypes.JSON, allowNull: true },
    ocorrido_em: { type: DataTypes.DATE(3), allowNull: false },
    registrado_em: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "registro_eventos", timestamps: false },
);

export type NovoRegistro = {
  tipo: string;
  categoria: Categoria;
  descricao: string;
  resultado?: Resultado;
  id_pedido?: number | null;
  id_usuario?: number | null;
  id_devolucao?: number | null;
  event_id?: string | null;
  origem?: string | null;
  request_id?: string | null;
  dados?: Record<string, unknown> | null;
  ocorrido_em?: Date | string;
};

const SERVICO = () => process.env.SERVICE_NAME || "agnus-notificacoes";
const inteiro = (valor: unknown) => (Number.isInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null);
const reais = (valor: unknown) =>
  Number.isFinite(Number(valor)) ? Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null;

// E-mail no registro só mascarado (dado pessoal): "b****@gmail.com". O id_usuario identifica o cliente.
export const mascararEmail = (email: string) => {
  const [nome, dominio] = email.split("@");
  if (!dominio) return "***";
  // Sempre 4 asteriscos: não revela nem o tamanho do nome.
  return `${nome.slice(0, 1)}****@${dominio}`;
};

const ROTULO_STATUS: Record<string, string> = {
  aguardando_calculo_frete: "aguardando cálculo do frete",
  aguardando_pagamento: "aguardando pagamento",
  pago: "pago",
  enviado: "enviado",
  entregue: "entregue",
  cancelado: "cancelado",
};

const STATUS_YOUDRAW: Record<string, string> = {
  awaiting_art: "aguardando arte",
  pending_payment: "aguardando pagamento",
  paid: "pago",
  in_production: "em produção",
  shipped: "enviado",
  delivered: "entregue",
  returned: "devolvido",
  canceled: "cancelado",
  other: "outro",
};

// Tradução de cada evento do barramento para uma linha do registro.
const DE_EVENTO: Record<string, (p: AgnusEvent["payload"]) => Omit<NovoRegistro, "tipo">> = {
  "pedido.criado": (p) => ({
    categoria: "pedido",
    descricao: `Pedido #${p.id_pedido} criado${reais(p.valor_total) ? ` (${reais(p.valor_total)})` : ""}`,
  }),
  "pedido.atualizado": (p) => {
    const pago = p.status === "pago";
    return {
      categoria: pago ? "pagamento" : "pedido",
      descricao: pago
        ? `Venda confirmada: pagamento do pedido #${p.id_pedido} aprovado`
        : `Pedido #${p.id_pedido}: ${ROTULO_STATUS[String(p.status_anterior)] ?? p.status_anterior} → ${ROTULO_STATUS[String(p.status)] ?? p.status}`,
      resultado: p.status === p.status_anterior ? "ignorado" : "sucesso",
    };
  },
  "pedido.removido": (p) => ({ categoria: "pedido", descricao: `Pedido #${p.id_pedido} removido` }),
  "usuario.removido": (p) => ({ categoria: "usuario", descricao: `Usuário #${p.id_usuario} removido` }),
  "produto.criado": (p) => ({ categoria: "catalogo", descricao: `Produto #${p.id_produto} criado` }),
  "produto.atualizado": (p) => ({ categoria: "catalogo", descricao: `Produto #${p.id_produto} atualizado` }),
  "produto.removido": (p) => ({ categoria: "catalogo", descricao: `Produto #${p.id_produto} removido` }),
  "categoria.criada": (p) => ({ categoria: "catalogo", descricao: `Categoria "${p.nome}" criada` }),
  "categoria.atualizada": (p) => ({ categoria: "catalogo", descricao: `Categoria "${p.nome}" atualizada` }),
  "categoria.removida": (p) => ({ categoria: "catalogo", descricao: `Categoria "${p.nome}" excluída` }),
  "vendas.atualizadas": () => ({ categoria: "sistema", descricao: "Contagem de vendas dos produtos atualizada" }),
  "afiliado.conversao": (p) =>
    p.status === "cancelada"
      ? {
          categoria: "afiliado",
          // Hoje só nasce cancelada a compra feita pelo próprio afiliado (autoindicação).
          descricao: `Compra do pedido #${p.id_pedido} veio do link do próprio afiliado #${p.id_afiliado}: sem comissão`,
          resultado: "ignorado",
        }
      : {
          categoria: "afiliado",
          descricao: `Venda do pedido #${p.id_pedido} atribuída ao afiliado #${p.id_afiliado}${reais(p.valor_comissao) ? ` (comissão ${reais(p.valor_comissao)})` : ""}`,
        },
  "fornecedor.pedido_criado": (p) => ({
    categoria: "fornecedor",
    descricao: `Pedido #${p.id_pedido} criado na YouDraw (${p.codigo_publico})${Number.isFinite(Number(p.total_centavos)) ? `: custo ${reais(Number(p.total_centavos) / 100)}` : ""}, aguardando o pagamento lá`,
  }),
  "fornecedor.pedido_falhou": (p) => ({
    categoria: "fornecedor",
    resultado: p.codigo === "integracao_desligada" ? "ignorado" : "falha",
    descricao:
      p.codigo === "integracao_desligada"
        ? `Pedido #${p.id_pedido} não foi enviado à YouDraw: integração desligada (fazer no painel)`
        : `Falha ao criar o pedido #${p.id_pedido} na YouDraw${p.retentavel ? " (vai tentar de novo)" : ""}: ${p.mensagem ?? p.codigo}`,
  }),
  "fornecedor.status": (p) => ({
    categoria: "fornecedor",
    descricao: `YouDraw: pedido #${p.id_pedido} (${p.codigo_publico}) ${STATUS_YOUDRAW[String(p.status_anterior)] ? `${STATUS_YOUDRAW[String(p.status_anterior)]} → ` : ""}${STATUS_YOUDRAW[String(p.status_externo)] ?? p.status_externo}`,
    resultado: p.status_externo === "canceled" || p.status_externo === "returned" ? "falha" : "sucesso",
  }),
  "afiliado.pagamento": (p) => ({
    categoria: "afiliado",
    descricao: `Comissão paga ao afiliado #${p.id_afiliado}: ${reais(p.valor) ?? p.valor} (${p.quantidade_conversoes} venda(s))`,
  }),
};

class RegistroService {
  // Nunca lança: registrar é efeito secundário e não pode derrubar o aviso, o e-mail ou o evento.
  static async registrar(registro: NovoRegistro) {
    try {
      await RegistroEventos.create({
        ...registro,
        descricao: registro.descricao.slice(0, 255),
        resultado: registro.resultado ?? "sucesso",
        origem: registro.origem ?? SERVICO(),
        ocorrido_em: registro.ocorrido_em ? new Date(registro.ocorrido_em) : new Date(),
      });
    } catch (error) {
      // Evento repetido (o mesmo event_id chegou duas vezes): já está registrado.
      if ((error as { name?: string }).name === "SequelizeUniqueConstraintError") return;
      logger.error("registro.falha_ao_gravar", { tipo: registro.tipo, error: error instanceof Error ? error.message : String(error) });
    }
  }

  static async registrarEvento(evento: AgnusEvent) {
    const traducao = DE_EVENTO[evento.type]?.(evento.payload) ?? { categoria: "sistema" as const, descricao: `Evento ${evento.type}` };

    await RegistroService.registrar({
      ...traducao,
      tipo: evento.type,
      event_id: evento.id,
      origem: evento.source,
      request_id: evento.requestId ?? null,
      id_pedido: inteiro(evento.payload.id_pedido),
      id_usuario: inteiro(evento.payload.id_usuario),
      dados: evento.payload as Record<string, unknown>,
      ocorrido_em: evento.occurredAt,
    });
  }

  // Consulta da equipe: filtros por categoria, tipo, pedido, cliente, devolução, resultado e período.
  static async listar(query: Record<string, unknown>) {
    const page = Math.max(1, Math.floor(Number(query.page) || 1));
    const limit = Math.min(200, Math.max(1, Math.floor(Number(query.limit) || 50)));
    const where: WhereOptions = {};
    const filtro = where as Record<string, unknown>;

    for (const campo of ["categoria", "resultado"] as const) {
      if (typeof query[campo] === "string" && query[campo]) filtro[campo] = query[campo];
    }
    if (typeof query.tipo === "string" && query.tipo) filtro.tipo = { [Op.like]: `${query.tipo.replace(/[%_]/g, "")}%` };
    for (const campo of ["id_pedido", "id_usuario", "id_devolucao"] as const) {
      if (query[campo] !== undefined && query[campo] !== "") {
        const valor = inteiro(query[campo]);
        if (!valor) throw new HttpError(400, `${campo} inválido.`);
        filtro[campo] = valor;
      }
    }

    const data = (valor: unknown, fim: boolean) => {
      if (typeof valor !== "string" || !valor) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new HttpError(400, "Datas no formato AAAA-MM-DD.");
      return new Date(`${valor}T${fim ? "23:59:59.999" : "00:00:00.000"}-03:00`);
    };
    const inicio = data(query.inicio, false);
    const fim = data(query.fim, true);
    if (inicio || fim) filtro.ocorrido_em = { ...(inicio ? { [Op.gte]: inicio } : {}), ...(fim ? { [Op.lte]: fim } : {}) };

    const { rows, count } = await RegistroEventos.findAndCountAll({
      where,
      order: [["ocorrido_em", "DESC"], ["id_registro", "DESC"]],
      limit,
      offset: (page - 1) * limit,
    });

    return {
      data: rows,
      pagination: { page, limit, total: count, totalPages: Math.max(1, Math.ceil(count / limit)), hasNextPage: page * limit < count, hasPreviousPage: page > 1 },
    };
  }
}

export default RegistroService;
