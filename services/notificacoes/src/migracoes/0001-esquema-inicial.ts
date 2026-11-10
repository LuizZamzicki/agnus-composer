import type { Migracao } from "@agnus/comum/utils/migracoes";

// Esquema de partida: copiado do banco em produção (SHOW CREATE TABLE) quando o sync automático foi
// abandonado. Em banco que já tem as tabelas, nada muda; em banco novo, cria tudo igual.
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS \`notificacoes\` (
  \`id_notificacao\` int NOT NULL AUTO_INCREMENT,
  \`id_usuario\` int NOT NULL,
  \`id_pedido\` int NOT NULL,
  \`titulo\` varchar(120) NOT NULL,
  \`mensagem\` varchar(255) NOT NULL,
  \`lida\` tinyint(1) NOT NULL DEFAULT '0',
  \`data_criacao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_notificacao\`),
  KEY \`FK_NOTIFICACOES_ID_USUARIO\` (\`id_usuario\`),
  KEY \`FK_NOTIFICACOES_ID_PEDIDO\` (\`id_pedido\`)
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
