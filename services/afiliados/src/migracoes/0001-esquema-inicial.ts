import type { Migracao } from "@agnus/comum/utils/migracoes";

// Programa de afiliados (modelo da Shopee Afiliados): o afiliado divulga links curtos, cada clique é
// registrado, a compra feita até X dias depois do último clique vira uma conversão, e a comissão de
// cada conversão passa por pendente -> aprovada -> paga (ou cancelada).
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS \`afiliados\` (
  \`id_afiliado\` int NOT NULL AUTO_INCREMENT,
  \`id_usuario\` int NOT NULL,
  \`codigo\` varchar(16) NOT NULL,
  \`nome_publico\` varchar(80) NOT NULL,
  \`canal\` varchar(255) DEFAULT NULL,
  \`chave_pix\` varchar(120) DEFAULT NULL,
  \`status\` enum('pendente','ativo','suspenso','recusado') NOT NULL DEFAULT 'pendente',
  \`taxa_personalizada\` decimal(5,2) DEFAULT NULL,
  \`app_id\` varchar(20) DEFAULT NULL,
  \`segredo_cifrado\` varchar(255) DEFAULT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_afiliado\`),
  UNIQUE KEY \`UQ_AFILIADOS_USUARIO\` (\`id_usuario\`),
  UNIQUE KEY \`UQ_AFILIADOS_CODIGO\` (\`codigo\`),
  UNIQUE KEY \`UQ_AFILIADOS_APP_ID\` (\`app_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`afiliado_links\` (
  \`id_link\` int NOT NULL AUTO_INCREMENT,
  \`id_afiliado\` int NOT NULL,
  \`slug\` varchar(16) NOT NULL,
  \`destino\` varchar(500) NOT NULL,
  \`sub_id1\` varchar(50) DEFAULT NULL,
  \`sub_id2\` varchar(50) DEFAULT NULL,
  \`sub_id3\` varchar(50) DEFAULT NULL,
  \`sub_id4\` varchar(50) DEFAULT NULL,
  \`sub_id5\` varchar(50) DEFAULT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_link\`),
  UNIQUE KEY \`UQ_LINKS_SLUG\` (\`slug\`),
  KEY \`IDX_LINKS_AFILIADO\` (\`id_afiliado\`),
  CONSTRAINT \`links_afiliado_fk\` FOREIGN KEY (\`id_afiliado\`) REFERENCES \`afiliados\` (\`id_afiliado\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`afiliado_cliques\` (
  \`id_clique\` bigint NOT NULL AUTO_INCREMENT,
  \`id_link\` int NOT NULL,
  \`id_afiliado\` int NOT NULL,
  \`ip_hash\` char(64) DEFAULT NULL,
  \`user_agent\` varchar(255) DEFAULT NULL,
  \`referer\` varchar(255) DEFAULT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_clique\`),
  KEY \`IDX_CLIQUES_AFILIADO_DATA\` (\`id_afiliado\`, \`data_criacao\`),
  KEY \`IDX_CLIQUES_LINK\` (\`id_link\`),
  CONSTRAINT \`cliques_link_fk\` FOREIGN KEY (\`id_link\`) REFERENCES \`afiliado_links\` (\`id_link\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`afiliado_regras_comissao\` (
  \`id_regra\` int NOT NULL AUTO_INCREMENT,
  \`tipo\` enum('padrao','categoria','produto') NOT NULL,
  \`referencia_id\` int NOT NULL DEFAULT '0',
  \`taxa\` decimal(5,2) NOT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_regra\`),
  UNIQUE KEY \`UQ_REGRAS_TIPO_REFERENCIA\` (\`tipo\`, \`referencia_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`afiliado_pagamentos\` (
  \`id_pagamento\` int NOT NULL AUTO_INCREMENT,
  \`id_afiliado\` int NOT NULL,
  \`valor\` decimal(12,2) NOT NULL,
  \`quantidade_conversoes\` int NOT NULL,
  \`referencia\` varchar(120) DEFAULT NULL,
  \`observacao\` varchar(255) DEFAULT NULL,
  \`id_usuario_admin\` int NOT NULL,
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_pagamento\`),
  KEY \`IDX_PAGAMENTOS_AFILIADO\` (\`id_afiliado\`),
  CONSTRAINT \`pagamentos_afiliado_fk\` FOREIGN KEY (\`id_afiliado\`) REFERENCES \`afiliados\` (\`id_afiliado\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`afiliado_conversoes\` (
  \`id_conversao\` int NOT NULL AUTO_INCREMENT,
  \`id_pedido\` int NOT NULL,
  \`id_afiliado\` int NOT NULL,
  \`id_link\` int DEFAULT NULL,
  \`id_clique\` bigint DEFAULT NULL,
  \`id_usuario_comprador\` int NOT NULL,
  \`status\` enum('aguardando_pagamento','pendente','aprovada','cancelada','paga') NOT NULL,
  \`status_pedido\` varchar(30) NOT NULL,
  \`valor_pedido\` decimal(12,2) NOT NULL,
  \`valor_comissionavel\` decimal(12,2) NOT NULL,
  \`valor_comissao\` decimal(12,2) NOT NULL,
  \`motivo_cancelamento\` varchar(120) DEFAULT NULL,
  \`data_clique\` datetime DEFAULT NULL,
  \`data_pedido\` datetime NOT NULL,
  \`data_entrega\` datetime DEFAULT NULL,
  \`liberada_em\` datetime DEFAULT NULL,
  \`data_aprovacao\` datetime DEFAULT NULL,
  \`id_pagamento\` int DEFAULT NULL,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_conversao\`),
  UNIQUE KEY \`UQ_CONVERSOES_PEDIDO\` (\`id_pedido\`),
  KEY \`IDX_CONVERSOES_AFILIADO_DATA\` (\`id_afiliado\`, \`data_pedido\`),
  KEY \`IDX_CONVERSOES_STATUS\` (\`status\`, \`liberada_em\`),
  CONSTRAINT \`conversoes_afiliado_fk\` FOREIGN KEY (\`id_afiliado\`) REFERENCES \`afiliados\` (\`id_afiliado\`),
  CONSTRAINT \`conversoes_pagamento_fk\` FOREIGN KEY (\`id_pagamento\`) REFERENCES \`afiliado_pagamentos\` (\`id_pagamento\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`afiliado_conversao_itens\` (
  \`id_conversao_item\` int NOT NULL AUTO_INCREMENT,
  \`id_conversao\` int NOT NULL,
  \`id_produto\` int NOT NULL,
  \`id_categoria\` int DEFAULT NULL,
  \`nome_produto\` varchar(255) DEFAULT NULL,
  \`quantidade\` int NOT NULL,
  \`valor\` decimal(12,2) NOT NULL,
  \`taxa\` decimal(5,2) NOT NULL,
  \`origem_taxa\` enum('padrao','categoria','produto','afiliado') NOT NULL,
  \`valor_comissao\` decimal(12,2) NOT NULL,
  PRIMARY KEY (\`id_conversao_item\`),
  KEY \`IDX_ITENS_CONVERSAO\` (\`id_conversao\`),
  CONSTRAINT \`itens_conversao_fk\` FOREIGN KEY (\`id_conversao\`) REFERENCES \`afiliado_conversoes\` (\`id_conversao\`) ON DELETE CASCADE
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
