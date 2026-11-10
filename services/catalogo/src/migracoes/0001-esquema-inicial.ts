import type { Migracao } from "@agnus/comum/utils/migracoes";

// Esquema de partida: copiado do banco em produção (SHOW CREATE TABLE) quando o sync automático foi
// abandonado. Em banco que já tem as tabelas, nada muda; em banco novo, cria tudo igual.
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS \`categorias\` (
  \`id_categoria\` int NOT NULL AUTO_INCREMENT,
  \`nome\` varchar(120) NOT NULL,
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_categoria\`),
  UNIQUE KEY \`UQ_CATEGORIAS_NOME\` (\`nome\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`produtos\` (
  \`id_produto\` int NOT NULL AUTO_INCREMENT,
  \`id_categoria\` int DEFAULT NULL,
  \`nome\` varchar(255) NOT NULL,
  \`descricao\` text,
  \`preco_custo\` decimal(10,2) DEFAULT '0.00',
  \`preco_base\` decimal(10,2) NOT NULL,
  \`margem_lucro\` decimal(5,2) DEFAULT NULL,
  \`ativo\` tinyint(1) DEFAULT '1',
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_produto\`),
  KEY \`FK_PRODUTOS_ID_CATEGORIA\` (\`id_categoria\`),
  FULLTEXT KEY \`ft_produtos_nome\` (\`nome\`),
  FULLTEXT KEY \`ft_produtos_descricao\` (\`descricao\`),
  FULLTEXT KEY \`idx_produtos_nome_descricao\` (\`nome\`,\`descricao\`),
  CONSTRAINT \`produtos_ibfk_1\` FOREIGN KEY (\`id_categoria\`) REFERENCES \`categorias\` (\`id_categoria\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`produto_cores\` (
  \`id_produto_cor\` int NOT NULL AUTO_INCREMENT,
  \`id_produto\` int NOT NULL,
  \`nome\` varchar(60) NOT NULL,
  \`codigo_rgb\` varchar(16) NOT NULL,
  \`acrescimo\` decimal(10,2) DEFAULT '0.00',
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_produto_cor\`),
  KEY \`FK_CORES_ID_PRODUTO\` (\`id_produto\`),
  CONSTRAINT \`produto_cores_ibfk_1\` FOREIGN KEY (\`id_produto\`) REFERENCES \`produtos\` (\`id_produto\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`produto_grades\` (
  \`id_produto_grade\` int NOT NULL AUTO_INCREMENT,
  \`id_produto\` int NOT NULL,
  \`nome\` varchar(60) NOT NULL,
  \`acrescimo\` decimal(10,2) DEFAULT '0.00',
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_produto_grade\`),
  KEY \`FK_PRDUTO_GRADES_ID_PRODUTO\` (\`id_produto\`),
  CONSTRAINT \`produto_grades_ibfk_1\` FOREIGN KEY (\`id_produto\`) REFERENCES \`produtos\` (\`id_produto\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`produto_fotos\` (
  \`id_produto_foto\` int NOT NULL AUTO_INCREMENT,
  \`id_produto\` int NOT NULL,
  \`id_produto_cor\` int NOT NULL,
  \`caminho_url\` text NOT NULL,
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_produto_foto\`),
  KEY \`FK_PRODUTO_FOTOS_ID_PRODUTO\` (\`id_produto\`),
  KEY \`FK_PRODUTO_FOTOS_ID_PRODUTO_COR\` (\`id_produto_cor\`),
  CONSTRAINT \`produto_fotos_ibfk_5\` FOREIGN KEY (\`id_produto\`) REFERENCES \`produtos\` (\`id_produto\`),
  CONSTRAINT \`produto_fotos_ibfk_6\` FOREIGN KEY (\`id_produto_cor\`) REFERENCES \`produto_cores\` (\`id_produto_cor\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`produto_vendas\` (
  \`id_produto\` int NOT NULL,
  \`quantidade_vendida\` int NOT NULL DEFAULT '0',
  PRIMARY KEY (\`id_produto\`)
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
