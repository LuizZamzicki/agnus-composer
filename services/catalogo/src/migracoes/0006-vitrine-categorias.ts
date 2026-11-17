import type { Migracao } from "@agnus/comum/utils/migracoes";

// Foto escolhida pela equipe para o bloco de cada categoria em "Compre por categoria".
// Sem linha aqui, o bloco usa a foto da peça mais vendida da categoria.
const migracao: Migracao = {
  nome: "0006-vitrine-categorias",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`vitrine_categorias\` (
  \`id_categoria\` int NOT NULL,
  \`imagem_url\` varchar(255) NOT NULL,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_categoria\`),
  CONSTRAINT \`vitrine_categorias_categoria_fk\` FOREIGN KEY (\`id_categoria\`) REFERENCES \`categorias\` (\`id_categoria\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
