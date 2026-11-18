import type { Migracao } from "@agnus/comum/utils/migracoes";

// SKU do fornecedor (YouDraw) de cada combinação cor + tamanho do produto. Guardado pelos NOMES
// da cor e do tamanho, não pelos ids: editar o produto recria cores e grades com ids novos e a
// ligação com a YouDraw não pode se perder a cada edição.
const migracao: Migracao = {
  nome: "0004-produto-skus",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`produto_skus\` (
  \`id_produto_sku\` int NOT NULL AUTO_INCREMENT,
  \`id_produto\` int NOT NULL,
  \`cor\` varchar(60) NOT NULL,
  \`tamanho\` varchar(60) NOT NULL,
  \`sku\` varchar(255) NOT NULL,
  \`fornecedor\` varchar(20) NOT NULL DEFAULT 'youdraw',
  \`id_produto_fornecedor\` varchar(64) DEFAULT NULL,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_produto_sku\`),
  UNIQUE KEY \`UQ_PRODUTO_SKUS_VARIANTE\` (\`id_produto\`, \`cor\`, \`tamanho\`),
  KEY \`IDX_PRODUTO_SKUS_SKU\` (\`sku\`),
  CONSTRAINT \`produto_skus_produto_fk\` FOREIGN KEY (\`id_produto\`) REFERENCES \`produtos\` (\`id_produto\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
