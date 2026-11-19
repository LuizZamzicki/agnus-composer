import { DataTypes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";

class Carrinhos extends Model {
  declare id_carrinho: number;
  declare id_usuario: number;
  declare lembretes_enviados: number;
  declare lembrete_em: Date | null;
  declare token_lembrete: string | null;
  declare data_criacao: Date;
  declare data_alteracao: Date;
}

Carrinhos.init(
  {
    id_carrinho: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    lembretes_enviados: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lembrete_em: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    token_lembrete: {
      type: DataTypes.CHAR(36),
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
    tableName: "carrinhos",
    timestamps: false,
    indexes: [
      {
        name: "FK_CARRINHOS_ID_USUARIO",
        fields: ["id_usuario"],
      },
    ],
  },
);

export default Carrinhos;
