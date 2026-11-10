import type { Migracao } from "@agnus/comum/utils/migracoes";

// Esquema de partida: copiado do banco em produção (SHOW CREATE TABLE) quando o sync automático foi
// abandonado. Em banco que já tem as tabelas, nada muda; em banco novo, cria tudo igual.
const TABELAS = [
  `CREATE TABLE IF NOT EXISTS \`pedidos\` (
  \`id_pedido\` int NOT NULL AUTO_INCREMENT,
  \`id_usuario\` int NOT NULL,
  \`id_usuario_endereco\` int NOT NULL,
  \`status\` enum('aguardando_calculo_frete','aguardando_pagamento','pago','enviado','entregue','cancelado') DEFAULT 'aguardando_pagamento',
  \`valor_total\` decimal(10,2) DEFAULT '0.00',
  \`valor_frete\` decimal(10,2) DEFAULT NULL,
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_pedido\`),
  KEY \`FK_PEDIDOS_ID_USUARIO\` (\`id_usuario\`),
  KEY \`FK_PEDIDOS_ID_USUARIO_ENDERECO\` (\`id_usuario_endereco\`),
  KEY \`idx_pedidos_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
  `CREATE TABLE IF NOT EXISTS \`pedido_itens\` (
  \`id_pedido_item\` int NOT NULL AUTO_INCREMENT,
  \`id_pedido\` int NOT NULL,
  \`id_produto_cor\` int NOT NULL,
  \`id_produto_grade\` int NOT NULL,
  \`quantidade\` int NOT NULL,
  \`preco_unitario\` decimal(10,2) NOT NULL,
  \`subtotal\` decimal(10,2) DEFAULT NULL,
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_pedido_item\`),
  KEY \`FK_PEDIDO_ITENS_ID_PEDIDO\` (\`id_pedido\`),
  KEY \`FK_PEDIDO_ITENS_ID_PRODUTO_COR\` (\`id_produto_cor\`),
  KEY \`FK_PEDIDO_ITENS_ID_PRODUTO_GRADE\` (\`id_produto_grade\`),
  CONSTRAINT \`pedido_itens_ibfk_1\` FOREIGN KEY (\`id_pedido\`) REFERENCES \`pedidos\` (\`id_pedido\`)
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
