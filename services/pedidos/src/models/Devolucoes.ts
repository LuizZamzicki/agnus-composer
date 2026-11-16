import { DataTypes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";

export type StatusDevolucao = "solicitada" | "aprovada" | "recusada" | "recebida" | "reembolsada" | "cancelada";
export type MotivoDevolucao = "arrependimento" | "tamanho" | "defeito" | "produto_errado";

export class Devolucoes extends Model {
  declare id_devolucao: number;
  declare id_pedido: number;
  declare id_usuario: number;
  declare status: StatusDevolucao;
  declare motivo: MotivoDevolucao;
  declare descricao: string | null;
  declare valor_reembolso: string | number;
  declare resposta_loja: string | null;
  declare codigo_postagem: string | null;
  declare forma_reembolso: "mercado_pago" | "manual" | null;
  declare referencia_reembolso: string | null;
  declare data_solicitacao: Date;
  declare data_resposta: Date | null;
  declare data_recebimento: Date | null;
  declare data_reembolso: Date | null;
  declare data_alteracao: Date;
  declare itens?: DevolucaoItens[];
  declare fotos?: DevolucaoFotos[];
}

Devolucoes.init(
  {
    id_devolucao: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    id_usuario: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.ENUM("solicitada", "aprovada", "recusada", "recebida", "reembolsada", "cancelada"),
      allowNull: false,
      defaultValue: "solicitada",
    },
    motivo: { type: DataTypes.ENUM("arrependimento", "tamanho", "defeito", "produto_errado"), allowNull: false },
    descricao: { type: DataTypes.STRING(1000), allowNull: true },
    valor_reembolso: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    resposta_loja: { type: DataTypes.STRING(1000), allowNull: true },
    codigo_postagem: { type: DataTypes.STRING(60), allowNull: true },
    forma_reembolso: { type: DataTypes.ENUM("mercado_pago", "manual"), allowNull: true },
    referencia_reembolso: { type: DataTypes.STRING(120), allowNull: true },
    data_solicitacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    data_resposta: { type: DataTypes.DATE, allowNull: true },
    data_recebimento: { type: DataTypes.DATE, allowNull: true },
    data_reembolso: { type: DataTypes.DATE, allowNull: true },
    data_alteracao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "devolucoes", timestamps: false },
);

export class DevolucaoItens extends Model {
  declare id_devolucao_item: number;
  declare id_devolucao: number;
  declare id_pedido_item: number;
  declare quantidade: number;
  declare valor: string | number;
}

DevolucaoItens.init(
  {
    id_devolucao_item: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_devolucao: { type: DataTypes.INTEGER, allowNull: false },
    id_pedido_item: { type: DataTypes.INTEGER, allowNull: false },
    quantidade: { type: DataTypes.INTEGER, allowNull: false },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  },
  { sequelize, tableName: "devolucao_itens", timestamps: false },
);

export class DevolucaoFotos extends Model {
  declare id_devolucao_foto: number;
  declare id_devolucao: number;
  declare arquivo: string;
  declare tipo: string;
  declare tamanho_bytes: number;
  declare data_criacao: Date;
}

DevolucaoFotos.init(
  {
    id_devolucao_foto: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_devolucao: { type: DataTypes.INTEGER, allowNull: false },
    arquivo: { type: DataTypes.STRING(100), allowNull: false },
    tipo: { type: DataTypes.STRING(10), allowNull: false },
    tamanho_bytes: { type: DataTypes.INTEGER, allowNull: false },
    data_criacao: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "devolucao_fotos", timestamps: false },
);

Devolucoes.hasMany(DevolucaoItens, { foreignKey: "id_devolucao", as: "itens" });
Devolucoes.hasMany(DevolucaoFotos, { foreignKey: "id_devolucao", as: "fotos" });
