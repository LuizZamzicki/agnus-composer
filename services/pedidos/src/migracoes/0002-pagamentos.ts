import type { Migracao } from "@agnus/comum/utils/migracoes";

// Cada tentativa de pagamento de um pedido no Mercado Pago. O pedido pode ter várias (cartão
// recusado, PIX expirado); o status do pedido muda só quando uma delas é aprovada.
const migracao: Migracao = {
  nome: "0002-pagamentos",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`pagamentos\` (
  \`id_pagamento\` int NOT NULL AUTO_INCREMENT,
  \`id_pedido\` int NOT NULL,
  \`mp_payment_id\` varchar(32) NOT NULL,
  \`metodo\` varchar(40) NOT NULL,
  \`status\` varchar(30) NOT NULL,
  \`status_detalhe\` varchar(80) DEFAULT NULL,
  \`valor\` decimal(10,2) NOT NULL,
  \`parcelas\` int DEFAULT NULL,
  \`pix_copia_e_cola\` text,
  \`pix_qr_code_base64\` mediumtext,
  \`pix_expira_em\` datetime DEFAULT NULL,
  \`data_criacao\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_pagamento\`),
  UNIQUE KEY \`UQ_PAGAMENTOS_MP_PAYMENT_ID\` (\`mp_payment_id\`),
  KEY \`idx_pagamentos_pedido\` (\`id_pedido\`),
  CONSTRAINT \`pagamentos_pedido_fk\` FOREIGN KEY (\`id_pedido\`) REFERENCES \`pedidos\` (\`id_pedido\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
