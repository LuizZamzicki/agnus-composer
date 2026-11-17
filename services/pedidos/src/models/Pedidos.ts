import { DataTypes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";

class Pedidos extends Model {
  declare id_pedido: number;
  declare id_usuario: number;
  declare id_usuario_endereco: number;
  declare status:
    | "aguardando_calculo_frete"
    | "aguardando_pagamento"
    | "pago"
    | "enviado"
    | "entregue"
    | "cancelado";
  declare valor_total: number | null;
  declare valor_frete: number | null;
  declare frete_gratis: boolean;
  declare frete_servico: string | null;
  declare frete_prazo_dias: number | null;
  declare cupom_codigo: string | null;
  declare valor_desconto: number | string;
  declare avaliacao_pedida_em: Date | null;
  declare codigo_rastreio: string | null;
  declare ref_afiliado: string | null;
  declare data_entrega: Date | null;
  declare data_criacao: Date;
  declare data_alteracao: Date;
}

Pedidos.init(
  {
    id_pedido: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_usuario_endereco: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "aguardando_calculo_frete",
        "aguardando_pagamento",
        "pago",
        "enviado",
        "entregue",
        "cancelado",
      ),
      allowNull: true,
      defaultValue: "aguardando_pagamento",
    },
    valor_total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },
    valor_frete: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
    },
    frete_gratis: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    frete_servico: {
      type: DataTypes.STRING(80),
      allowNull: true,
      defaultValue: null,
    },
    frete_prazo_dias: {
      type: DataTypes.SMALLINT,
      allowNull: true,
      defaultValue: null,
    },
    cupom_codigo: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
    },
    valor_desconto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    avaliacao_pedida_em: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    codigo_rastreio: {
      type: DataTypes.STRING(36),
      allowNull: true,
      defaultValue: null,
    },
    ref_afiliado: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: null,
    },
    data_entrega: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    data_criacao: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    data_alteracao: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "pedidos",
    timestamps: false,
    indexes: [
      {
        name: "FK_PEDIDOS_ID_USUARIO",
        fields: ["id_usuario"],
      },
      {
        name: "FK_PEDIDOS_ID_USUARIO_ENDERECO",
        fields: ["id_usuario_endereco"],
      },
      {
        name: "idx_pedidos_status",
        fields: ["status"],
      },
    ],
  },
);

export default Pedidos;
