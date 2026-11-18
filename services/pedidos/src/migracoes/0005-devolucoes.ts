import type { Migracao } from "@agnus/comum/utils/migracoes";

// Devoluções (trocas não: o cliente devolve e é reembolsado). Uma devolução cobre uma ou mais peças
// de um pedido entregue; o pedido pode ter mais de uma, mas só uma em andamento por vez.
// data_entrega no pedido conta o prazo (7 dias de arrependimento, CDC art. 49; mais para defeito).
const migracao: Migracao = {
  nome: "0005-devolucoes",
  up: async (banco) => {
    const [colunas] = await banco.query("SHOW COLUMNS FROM `pedidos` LIKE 'data_entrega'");

    if ((colunas as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `pedidos` ADD COLUMN `data_entrega` datetime DEFAULT NULL AFTER `ref_afiliado`");
      // Pedidos já entregues: a melhor data que existe é a da última alteração.
      await banco.query("UPDATE `pedidos` SET `data_entrega` = COALESCE(`data_alteracao`, `data_criacao`) WHERE `status` = 'entregue'");
    }

    await banco.query(`CREATE TABLE IF NOT EXISTS \`devolucoes\` (
  \`id_devolucao\` int NOT NULL AUTO_INCREMENT,
  \`id_pedido\` int NOT NULL,
  \`id_usuario\` int NOT NULL,
  \`status\` enum('solicitada','aprovada','recusada','recebida','reembolsada','cancelada') NOT NULL DEFAULT 'solicitada',
  \`motivo\` enum('arrependimento','tamanho','defeito','produto_errado') NOT NULL,
  \`descricao\` varchar(1000) DEFAULT NULL,
  \`valor_reembolso\` decimal(10,2) NOT NULL,
  \`resposta_loja\` varchar(1000) DEFAULT NULL,
  \`codigo_postagem\` varchar(60) DEFAULT NULL,
  \`forma_reembolso\` enum('mercado_pago','manual') DEFAULT NULL,
  \`referencia_reembolso\` varchar(120) DEFAULT NULL,
  \`data_solicitacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`data_resposta\` datetime DEFAULT NULL,
  \`data_recebimento\` datetime DEFAULT NULL,
  \`data_reembolso\` datetime DEFAULT NULL,
  \`data_alteracao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_devolucao\`),
  KEY \`IDX_DEVOLUCOES_PEDIDO\` (\`id_pedido\`),
  KEY \`IDX_DEVOLUCOES_USUARIO\` (\`id_usuario\`),
  KEY \`IDX_DEVOLUCOES_STATUS\` (\`status\`),
  CONSTRAINT \`devolucoes_pedido_fk\` FOREIGN KEY (\`id_pedido\`) REFERENCES \`pedidos\` (\`id_pedido\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    await banco.query(`CREATE TABLE IF NOT EXISTS \`devolucao_itens\` (
  \`id_devolucao_item\` int NOT NULL AUTO_INCREMENT,
  \`id_devolucao\` int NOT NULL,
  \`id_pedido_item\` int NOT NULL,
  \`quantidade\` int NOT NULL,
  \`valor\` decimal(10,2) NOT NULL,
  PRIMARY KEY (\`id_devolucao_item\`),
  KEY \`IDX_DEVOLUCAO_ITENS_DEVOLUCAO\` (\`id_devolucao\`),
  KEY \`IDX_DEVOLUCAO_ITENS_PEDIDO_ITEM\` (\`id_pedido_item\`),
  CONSTRAINT \`devolucao_itens_devolucao_fk\` FOREIGN KEY (\`id_devolucao\`) REFERENCES \`devolucoes\` (\`id_devolucao\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
