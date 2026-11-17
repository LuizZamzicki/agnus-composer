import type { Migracao } from "@agnus/comum/utils/migracoes";

// Ofertas por e-mail e cupom de primeira compra: cada inscrição ganha um código único de 10%.
// No pedido ficam o cupom usado, o desconto, se o frete saiu grátis (peças a partir de R$ 250)
// e quando foi pedido ao cliente que avaliasse as peças.
const colunas: [string, string][] = [
  ["frete_gratis", "tinyint(1) NOT NULL DEFAULT 0 AFTER `valor_frete`"],
  ["cupom_codigo", "varchar(40) DEFAULT NULL AFTER `frete_gratis`"],
  ["valor_desconto", "decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `cupom_codigo`"],
  ["avaliacao_pedida_em", "datetime DEFAULT NULL AFTER `data_entrega`"],
];

const migracao: Migracao = {
  nome: "0008-ofertas-cupons",
  up: async (banco) => {
    for (const [nome, definicao] of colunas) {
      const [existe] = await banco.query(`SHOW COLUMNS FROM \`pedidos\` LIKE '${nome}'`);
      if ((existe as unknown[]).length === 0) {
        await banco.query(`ALTER TABLE \`pedidos\` ADD COLUMN \`${nome}\` ${definicao}`);
      }
    }

    await banco.query(`CREATE TABLE IF NOT EXISTS \`ofertas_inscricoes\` (
  \`id_inscricao\` int NOT NULL AUTO_INCREMENT,
  \`email\` varchar(180) NOT NULL,
  \`cupom_codigo\` varchar(40) NOT NULL,
  \`token_cancelar\` char(36) NOT NULL,
  \`ativo\` tinyint(1) NOT NULL DEFAULT 1,
  \`origem\` varchar(30) NOT NULL DEFAULT 'home',
  \`data_criacao\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`data_cancelamento\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id_inscricao\`),
  UNIQUE KEY \`UQ_OFERTAS_EMAIL\` (\`email\`),
  UNIQUE KEY \`UQ_OFERTAS_CUPOM\` (\`cupom_codigo\`),
  UNIQUE KEY \`UQ_OFERTAS_TOKEN\` (\`token_cancelar\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);

    const [indice] = await banco.query("SHOW INDEX FROM `pedidos` WHERE Key_name = 'IDX_PEDIDOS_CUPOM'");
    if ((indice as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `pedidos` ADD INDEX `IDX_PEDIDOS_CUPOM` (`cupom_codigo`)");
    }
  },
};

export default migracao;
