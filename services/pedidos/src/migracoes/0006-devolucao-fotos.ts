import type { Migracao } from "@agnus/comum/utils/migracoes";

// Fotos que o cliente anexa ao pedido de devolução (ex.: o defeito da peça). O arquivo fica no
// volume devolucao_fotos e só é servido com login (dono da devolução ou equipe), nunca como estático.
const migracao: Migracao = {
  nome: "0006-devolucao-fotos",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`devolucao_fotos\` (
  \`id_devolucao_foto\` int NOT NULL AUTO_INCREMENT,
  \`id_devolucao\` int NOT NULL,
  \`arquivo\` varchar(100) NOT NULL,
  \`tipo\` varchar(10) NOT NULL,
  \`tamanho_bytes\` int NOT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_devolucao_foto\`),
  UNIQUE KEY \`UQ_DEVOLUCAO_FOTOS_ARQUIVO\` (\`arquivo\`),
  KEY \`IDX_DEVOLUCAO_FOTOS_DEVOLUCAO\` (\`id_devolucao\`),
  CONSTRAINT \`devolucao_fotos_devolucao_fk\` FOREIGN KEY (\`id_devolucao\`) REFERENCES \`devolucoes\` (\`id_devolucao\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
