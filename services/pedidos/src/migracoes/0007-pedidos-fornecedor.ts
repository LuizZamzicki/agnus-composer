import type { Migracao } from "@agnus/comum/utils/migracoes";

// Situação de cada pedido no fornecedor que produz e envia (YouDraw): se já foi criado lá, o código
// público (YD-...), o status do lado deles, valores, rastreio e o último erro. A chave de
// idempotência é gerada uma vez por pedido e reusada em cada nova tentativa (nunca duplica lá).
const migracao: Migracao = {
  nome: "0007-pedidos-fornecedor",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`pedidos_fornecedor\` (
  \`id_pedido\` int NOT NULL,
  \`fornecedor\` varchar(20) NOT NULL DEFAULT 'youdraw',
  \`situacao\` enum('aguardando','enviado','erro','manual') NOT NULL DEFAULT 'aguardando',
  \`chave_idempotencia\` char(36) NOT NULL,
  \`id_externo\` varchar(64) DEFAULT NULL,
  \`codigo_publico\` varchar(32) DEFAULT NULL,
  \`status_externo\` varchar(30) DEFAULT NULL,
  \`total_centavos\` int DEFAULT NULL,
  \`frete_centavos\` int DEFAULT NULL,
  \`rastreio_codigo\` varchar(64) DEFAULT NULL,
  \`rastreio_url\` varchar(500) DEFAULT NULL,
  \`erro_codigo\` varchar(60) DEFAULT NULL,
  \`erro\` varchar(255) DEFAULT NULL,
  \`retentavel\` tinyint(1) NOT NULL DEFAULT 0,
  \`tentativas\` int NOT NULL DEFAULT 0,
  \`data_envio\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_pedido\`),
  UNIQUE KEY \`UQ_PEDIDOS_FORNECEDOR_EXTERNO\` (\`id_externo\`),
  KEY \`IDX_PEDIDOS_FORNECEDOR_SITUACAO\` (\`situacao\`, \`retentavel\`),
  CONSTRAINT \`pedidos_fornecedor_pedido_fk\` FOREIGN KEY (\`id_pedido\`) REFERENCES \`pedidos\` (\`id_pedido\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
