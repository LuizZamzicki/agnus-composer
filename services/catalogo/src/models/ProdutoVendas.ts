import { DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import sequelize from "@agnus/comum/config/database";

// Projeção local: o total vem do serviço de pedidos, para o catálogo não consultar o banco dele.
class ProdutoVendas extends Model<InferAttributes<ProdutoVendas>, InferCreationAttributes<ProdutoVendas>> {
  declare id_produto: number;
  declare quantidade_vendida: number;
}

ProdutoVendas.init(
  {
    id_produto: { type: DataTypes.INTEGER, primaryKey: true },
    quantidade_vendida: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, tableName: "produto_vendas", timestamps: false },
);

export default ProdutoVendas;
