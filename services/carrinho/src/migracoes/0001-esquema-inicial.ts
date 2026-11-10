import type { Migracao } from "@agnus/comum/utils/migracoes";

// Esquema de partida: copiado do banco em produção (SHOW CREATE TABLE) quando o sync automático foi
// abandonado. Em banco que já tem as tabelas, nada muda; em banco novo, cria tudo igual.
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS \`carrinhos\` (
  \`id_carrinho\` int NOT NULL AUTO_INCREMENT,
  \`id_usuario\` int NOT NULL,
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_carrinho\`),
  KEY \`FK_CARRINHOS_ID_USUARIO\` (\`id_usuario\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`carrinho_itens\` (
  \`id_carrinho_item\` int NOT NULL AUTO_INCREMENT,
  \`id_carrinho\` int NOT NULL,
  \`id_produto_cor\` int NOT NULL,
  \`id_produto_grade\` int NOT NULL,
  \`quantidade\` int DEFAULT '1',
  \`preco_unitario\` decimal(10,2) NOT NULL,
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_carrinho_item\`),
  KEY \`FK_CARRINHO_ITENS_ID_CARRINHO\` (\`id_carrinho\`),
  KEY \`FK_CARRINHO_ITENS_ID_PRODUTO_COR\` (\`id_produto_cor\`),
  KEY \`FK_CARRINHO_ITENS_ID_PRODUTO_GRADE\` (\`id_produto_grade\`),
  CONSTRAINT \`carrinho_itens_ibfk_1\` FOREIGN KEY (\`id_carrinho\`) REFERENCES \`carrinhos\` (\`id_carrinho\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
];

const migracao: Migracao = {
  nome: "0001-esquema-inicial",
  up: async (banco) => {
    for (const sql of TABELAS) {
      await banco.query(sql);
    }
  },
};

export default migracao;
