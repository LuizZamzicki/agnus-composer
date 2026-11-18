import { DataTypes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";

export type StatusAfiliado = "pendente" | "ativo" | "suspenso" | "recusado";
export type StatusConversao = "aguardando_pagamento" | "pendente" | "aprovada" | "cancelada" | "paga";
export type TipoRegra = "padrao" | "categoria" | "produto";
export type OrigemTaxa = TipoRegra | "afiliado";

const comum = { sequelize, timestamps: false } as const;

export class Afiliados extends Model {
  declare id_afiliado: number;
  declare id_usuario: number;
  declare codigo: string;
  declare nome_publico: string;
  declare canal: string | null;
  declare chave_pix: string | null;
  declare status: StatusAfiliado;
  declare taxa_personalizada: string | number | null;
  declare app_id: string | null;
  declare segredo_cifrado: string | null;
  declare data_criacao: Date;
  declare data_alteracao: Date;
}

Afiliados.init(
  {
    id_afiliado: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_usuario: { type: DataTypes.INTEGER, allowNull: false },
    codigo: { type: DataTypes.STRING(16), allowNull: false },
    nome_publico: { type: DataTypes.STRING(80), allowNull: false },
    canal: { type: DataTypes.STRING(255), allowNull: true },
    chave_pix: { type: DataTypes.STRING(120), allowNull: true },
    status: { type: DataTypes.ENUM("pendente", "ativo", "suspenso", "recusado"), allowNull: false, defaultValue: "pendente" },
    taxa_personalizada: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    app_id: { type: DataTypes.STRING(20), allowNull: true },
    segredo_cifrado: { type: DataTypes.STRING(255), allowNull: true },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    data_alteracao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...comum, tableName: "afiliados" },
);

export class AfiliadoLinks extends Model {
  declare id_link: number;
  declare id_afiliado: number;
  declare slug: string;
  declare destino: string;
  declare sub_id1: string | null;
  declare sub_id2: string | null;
  declare sub_id3: string | null;
  declare sub_id4: string | null;
  declare sub_id5: string | null;
  declare data_criacao: Date;
}

AfiliadoLinks.init(
  {
    id_link: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_afiliado: { type: DataTypes.INTEGER, allowNull: false },
    slug: { type: DataTypes.STRING(16), allowNull: false },
    destino: { type: DataTypes.STRING(500), allowNull: false },
    sub_id1: { type: DataTypes.STRING(50), allowNull: true },
    sub_id2: { type: DataTypes.STRING(50), allowNull: true },
    sub_id3: { type: DataTypes.STRING(50), allowNull: true },
    sub_id4: { type: DataTypes.STRING(50), allowNull: true },
    sub_id5: { type: DataTypes.STRING(50), allowNull: true },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...comum, tableName: "afiliado_links" },
);

export class AfiliadoCliques extends Model {
  declare id_clique: number;
  declare id_link: number;
  declare id_afiliado: number;
  declare ip_hash: string | null;
  declare user_agent: string | null;
  declare referer: string | null;
  declare data_criacao: Date;
}

AfiliadoCliques.init(
  {
    id_clique: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    id_link: { type: DataTypes.INTEGER, allowNull: false },
    id_afiliado: { type: DataTypes.INTEGER, allowNull: false },
    ip_hash: { type: DataTypes.CHAR(64), allowNull: true },
    user_agent: { type: DataTypes.STRING(255), allowNull: true },
    referer: { type: DataTypes.STRING(255), allowNull: true },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...comum, tableName: "afiliado_cliques" },
);

export class RegrasComissao extends Model {
  declare id_regra: number;
  declare tipo: TipoRegra;
  declare referencia_id: number;
  declare taxa: string | number;
  declare data_criacao: Date;
  declare data_alteracao: Date;
}

RegrasComissao.init(
  {
    id_regra: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tipo: { type: DataTypes.ENUM("padrao", "categoria", "produto"), allowNull: false },
    referencia_id: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    taxa: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    data_alteracao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...comum, tableName: "afiliado_regras_comissao" },
);

export class AfiliadoPagamentos extends Model {
  declare id_pagamento: number;
  declare id_afiliado: number;
  declare valor: string | number;
  declare quantidade_conversoes: number;
  declare referencia: string | null;
  declare observacao: string | null;
  declare id_usuario_admin: number;
  declare data_criacao: Date;
}

AfiliadoPagamentos.init(
  {
    id_pagamento: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_afiliado: { type: DataTypes.INTEGER, allowNull: false },
    valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    quantidade_conversoes: { type: DataTypes.INTEGER, allowNull: false },
    referencia: { type: DataTypes.STRING(120), allowNull: true },
    observacao: { type: DataTypes.STRING(255), allowNull: true },
    id_usuario_admin: { type: DataTypes.INTEGER, allowNull: false },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...comum, tableName: "afiliado_pagamentos" },
);

export class Conversoes extends Model {
  declare id_conversao: number;
  declare id_pedido: number;
  declare id_afiliado: number;
  declare id_link: number | null;
  declare id_clique: number | null;
  declare id_usuario_comprador: number;
  declare status: StatusConversao;
  declare status_pedido: string;
  declare valor_pedido: string | number;
  declare valor_comissionavel: string | number;
  declare valor_comissao: string | number;
  declare motivo_cancelamento: string | null;
  declare data_clique: Date | null;
  declare data_pedido: Date;
  declare data_entrega: Date | null;
  declare liberada_em: Date | null;
  declare data_aprovacao: Date | null;
  declare id_pagamento: number | null;
  declare data_alteracao: Date;
  declare itens?: ConversaoItens[];
  declare link?: AfiliadoLinks | null;
}

Conversoes.init(
  {
    id_conversao: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    id_afiliado: { type: DataTypes.INTEGER, allowNull: false },
    id_link: { type: DataTypes.INTEGER, allowNull: true },
    id_clique: { type: DataTypes.BIGINT, allowNull: true },
    id_usuario_comprador: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM("aguardando_pagamento", "pendente", "aprovada", "cancelada", "paga"),
      allowNull: false,
    },
    status_pedido: { type: DataTypes.STRING(30), allowNull: false },
    valor_pedido: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    valor_comissionavel: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    valor_comissao: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    motivo_cancelamento: { type: DataTypes.STRING(120), allowNull: true },
    data_clique: { type: DataTypes.DATE, allowNull: true },
    data_pedido: { type: DataTypes.DATE, allowNull: false },
    data_entrega: { type: DataTypes.DATE, allowNull: true },
    liberada_em: { type: DataTypes.DATE, allowNull: true },
    data_aprovacao: { type: DataTypes.DATE, allowNull: true },
    id_pagamento: { type: DataTypes.INTEGER, allowNull: true },
    data_alteracao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { ...comum, tableName: "afiliado_conversoes" },
);

export class ConversaoItens extends Model {
  declare id_conversao_item: number;
  declare id_conversao: number;
  declare id_produto: number;
  declare id_categoria: number | null;
  declare nome_produto: string | null;
  declare quantidade: number;
  declare valor: string | number;
  declare taxa: string | number;
  declare origem_taxa: OrigemTaxa;
  declare valor_comissao: string | number;
}

ConversaoItens.init(
  {
    id_conversao_item: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_conversao: { type: DataTypes.INTEGER, allowNull: false },
    id_produto: { type: DataTypes.INTEGER, allowNull: false },
    id_categoria: { type: DataTypes.INTEGER, allowNull: true },
    nome_produto: { type: DataTypes.STRING(255), allowNull: true },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    taxa: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
    origem_taxa: { type: DataTypes.ENUM("padrao", "categoria", "produto", "afiliado"), allowNull: false },
    valor_comissao: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  },
  { ...comum, tableName: "afiliado_conversao_itens" },
);

Conversoes.hasMany(ConversaoItens, { foreignKey: "id_conversao", as: "itens" });
Conversoes.belongsTo(AfiliadoLinks, { foreignKey: "id_link", as: "link" });
