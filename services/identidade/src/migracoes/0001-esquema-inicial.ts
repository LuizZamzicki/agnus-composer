import type { Migracao } from "@agnus/comum/utils/migracoes";

// Esquema de partida: copiado do banco em produção (SHOW CREATE TABLE) quando o sync automático foi
// abandonado. Em banco que já tem as tabelas, nada muda; em banco novo, cria tudo igual.
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS \`usuarios\` (
  \`id_usuario\` int NOT NULL AUTO_INCREMENT,
  \`nome\` varchar(120) NOT NULL,
  \`cpf\` varchar(14) DEFAULT NULL,
  \`email\` varchar(120) NOT NULL,
  \`senha\` varchar(255) NOT NULL,
  \`google_id\` varchar(64) DEFAULT NULL,
  \`tipo\` enum('cliente','administrador') NOT NULL DEFAULT 'cliente',
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_usuario\`),
  UNIQUE KEY \`UQ_USUARIOS_EMAIL\` (\`email\`),
  UNIQUE KEY \`UQ_USUARIOS_GOOGLE_ID\` (\`google_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`usuario_senhas_historico\` (
  \`id_usuario_senha_hist\` int NOT NULL AUTO_INCREMENT,
  \`id_usuario\` int NOT NULL,
  \`senha\` varchar(255) NOT NULL,
  \`data_criacao\` datetime NOT NULL,
  PRIMARY KEY (\`id_usuario_senha_hist\`),
  KEY \`idx_hist_usuario_data\` (\`id_usuario\`,\`data_criacao\`),
  CONSTRAINT \`usuario_senhas_historico_ibfk_1\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\` (\`id_usuario\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`usuario_enderecos\` (
  \`id_usuario_endereco\` int NOT NULL AUTO_INCREMENT,
  \`id_usuario\` int NOT NULL,
  \`cep\` varchar(9) NOT NULL,
  \`logradouro\` varchar(255) NOT NULL,
  \`numero\` varchar(20) DEFAULT NULL,
  \`complemento\` varchar(120) DEFAULT NULL,
  \`bairro\` varchar(120) DEFAULT NULL,
  \`cidade\` varchar(120) DEFAULT NULL,
  \`estado\` varchar(2) DEFAULT NULL,
  \`pais\` varchar(60) DEFAULT 'Brasil',
  \`principal\` tinyint(1) DEFAULT '0',
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  \`ativo\` tinyint(1) DEFAULT '1',
  PRIMARY KEY (\`id_usuario_endereco\`),
  KEY \`FK_USUARIO_ENDERECOS_ID_USUARIO\` (\`id_usuario\`),
  CONSTRAINT \`usuario_enderecos_ibfk_1\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\` (\`id_usuario\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`usuario_contatos\` (
  \`id_usuario_contato\` int NOT NULL AUTO_INCREMENT,
  \`id_usuario\` int NOT NULL,
  \`tipo\` enum('telefone','celular','email','outro') DEFAULT 'celular',
  \`valor\` varchar(120) NOT NULL,
  \`principal\` tinyint(1) DEFAULT '0',
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_usuario_contato\`),
  KEY \`FK_USUARIO_CONTATOS_ID_USUARIO\` (\`id_usuario\`),
  CONSTRAINT \`usuario_contatos_ibfk_1\` FOREIGN KEY (\`id_usuario\`) REFERENCES \`usuarios\` (\`id_usuario\`)
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
