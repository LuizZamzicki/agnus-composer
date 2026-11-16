import type { Migracao } from "@agnus/comum/utils/migracoes";

// Registro permanente do que aconteceu no sistema: eventos de negócio (pedido criado, pago,
// enviado...), e-mails enviados (ou que falharam), avisos no site, devoluções e afiliação.
// Uma linha por acontecimento, com descrição legível e as referências para filtrar por pedido.
// Substitui a lista de auditoria no Redis, que guardava só os últimos 500 eventos.
const migracao: Migracao = {
  nome: "0002-registro-eventos",
  up: async (banco) => {
    await banco.query(`CREATE TABLE IF NOT EXISTS \`registro_eventos\` (
  \`id_registro\` bigint NOT NULL AUTO_INCREMENT,
  \`event_id\` varchar(36) DEFAULT NULL,
  \`tipo\` varchar(60) NOT NULL,
  \`categoria\` enum('pedido','pagamento','devolucao','email','aviso','catalogo','usuario','afiliado','sistema') NOT NULL,
  \`descricao\` varchar(255) NOT NULL,
  \`resultado\` enum('sucesso','falha','ignorado') NOT NULL DEFAULT 'sucesso',
  \`id_pedido\` int DEFAULT NULL,
  \`id_usuario\` int DEFAULT NULL,
  \`id_devolucao\` int DEFAULT NULL,
  \`origem\` varchar(40) DEFAULT NULL,
  \`request_id\` varchar(64) DEFAULT NULL,
  \`dados\` json DEFAULT NULL,
  \`ocorrido_em\` datetime(3) NOT NULL,
  \`registrado_em\` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id_registro\`),
  UNIQUE KEY \`UQ_REGISTRO_EVENT_ID\` (\`event_id\`),
  KEY \`IDX_REGISTRO_PEDIDO\` (\`id_pedido\`, \`ocorrido_em\`),
  KEY \`IDX_REGISTRO_USUARIO\` (\`id_usuario\`, \`ocorrido_em\`),
  KEY \`IDX_REGISTRO_CATEGORIA\` (\`categoria\`, \`ocorrido_em\`),
  KEY \`IDX_REGISTRO_OCORRIDO\` (\`ocorrido_em\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
