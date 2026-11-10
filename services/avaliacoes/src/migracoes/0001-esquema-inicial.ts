import type { Migracao } from "@agnus/comum/utils/migracoes";

// Esquema de partida: copiado do banco em produção (SHOW CREATE TABLE) quando o sync automático foi
// abandonado. Em banco que já tem as tabelas, nada muda; em banco novo, cria tudo igual.
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS \`avaliacao_produtos\` (
  \`id_avaliacao_produto\` int NOT NULL AUTO_INCREMENT,
  \`id_produto\` int NOT NULL,
  \`id_usuario\` int NOT NULL,
  \`titulo\` varchar(100) DEFAULT NULL,
  \`comentario\` text,
  \`nota\` decimal(10,1) DEFAULT NULL,
  PRIMARY KEY (\`id_avaliacao_produto\`),
  KEY \`FK_AVALIACAO_PRODUTOS_ID_PRODUTO\` (\`id_produto\`),
  KEY \`FK_AVALIACAO_PRODUTOS_ID_USUARIO\` (\`id_usuario\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`avaliacao_fotos\` (
  \`id_avaliacao_foto\` int NOT NULL AUTO_INCREMENT,
  \`id_avaliacao_produto\` int NOT NULL,
  \`caminho_url\` text,
  PRIMARY KEY (\`id_avaliacao_foto\`),
  KEY \`FK_AVALIACAO_FOTO_ID_AVALIACAO_PRODUTO\` (\`id_avaliacao_produto\`),
  CONSTRAINT \`avaliacao_fotos_ibfk_1\` FOREIGN KEY (\`id_avaliacao_produto\`) REFERENCES \`avaliacao_produtos\` (\`id_avaliacao_produto\`)
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
