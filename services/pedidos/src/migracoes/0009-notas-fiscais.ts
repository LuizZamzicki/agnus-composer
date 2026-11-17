import type { Migracao } from "@agnus/comum/utils/migracoes";

// NF-e de cada pedido: chave de acesso, número, série, emissão, valor e os arquivos (DANFE em PDF e
// XML autorizado) gravados no volume notas_fiscais. Uma nota por pedido.
const migracao: Migracao = {
  nome: "0009-notas-fiscais",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`pedidos_notas_fiscais\` (
  \`id_pedido\` int NOT NULL,
  \`chave\` char(44) NOT NULL,
  \`numero\` varchar(12) DEFAULT NULL,
  \`serie\` varchar(4) DEFAULT NULL,
  \`data_emissao\` datetime DEFAULT NULL,
  \`valor\` decimal(10,2) DEFAULT NULL,
  \`arquivo_pdf\` varchar(100) DEFAULT NULL,
  \`arquivo_xml\` varchar(100) DEFAULT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_pedido\`),
  UNIQUE KEY \`UQ_NOTAS_FISCAIS_CHAVE\` (\`chave\`),
  CONSTRAINT \`notas_fiscais_pedido_fk\` FOREIGN KEY (\`id_pedido\`) REFERENCES \`pedidos\` (\`id_pedido\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
