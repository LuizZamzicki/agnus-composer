import { DataTypes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";

class Notificacoes extends Model {
  declare id_notificacao: number;
  declare id_usuario: number;
  declare id_pedido: number;
  declare titulo: string;
  declare mensagem: string;
  declare lida: boolean;
  declare data_criacao: Date;
}

Notificacoes.init(
  {
    id_notificacao: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    id_pedido: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    titulo: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    mensagem: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    lida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    data_criacao: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "notificacoes",
    timestamps: false,
    indexes: [
      {
        name: "FK_NOTIFICACOES_ID_USUARIO",
        fields: ["id_usuario"],
      },
      {
        name: "FK_NOTIFICACOES_ID_PEDIDO",
        fields: ["id_pedido"],
      },
    ],
  },
);

export default Notificacoes;
