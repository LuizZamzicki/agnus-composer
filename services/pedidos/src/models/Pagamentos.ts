import { DataTypes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";

// Uma tentativa de pagamento no Mercado Pago (tabela criada pela migração 0002-pagamentos).
class Pagamentos extends Model {
  declare id_pagamento: number;
  declare id_pedido: number;
  declare mp_payment_id: string;
  declare metodo: string;
  declare status: string;
  declare status_detalhe: string | null;
  declare valor: number;
  declare parcelas: number | null;
  declare pix_copia_e_cola: string | null;
  declare pix_qr_code_base64: string | null;
  declare pix_expira_em: Date | null;
  declare data_criacao: Date;
  declare data_alteracao: Date;
}

Pagamentos.init(
  {
    id_pagamento: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_pedido: { type: DataTypes.INTEGER, allowNull: false },
    mp_payment_id: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    metodo: { type: DataTypes.STRING(40), allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false },
    status_detalhe: { type: DataTypes.STRING(80), allowNull: true },
    valor: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    parcelas: { type: DataTypes.INTEGER, allowNull: true },
    pix_copia_e_cola: { type: DataTypes.TEXT, allowNull: true },
    pix_qr_code_base64: { type: DataTypes.TEXT("medium"), allowNull: true },
    pix_expira_em: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "pagamentos",
    timestamps: true,
    createdAt: "data_criacao",
    updatedAt: "data_alteracao",
  },
);

export default Pagamentos;
