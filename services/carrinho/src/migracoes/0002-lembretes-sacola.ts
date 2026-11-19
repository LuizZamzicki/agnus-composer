import type { Migracao } from "@agnus/comum/utils/migracoes";

// Lembrete de sacola esquecida: quantos e-mails a sacola já mandou desde a última mudança, quando
// foi o último e o código do link "não quero mais receber". Quem cancelou fica na outra tabela.
const colunas: [string, string][] = [
  ["lembretes_enviados", "int NOT NULL DEFAULT 0"],
  ["lembrete_em", "datetime DEFAULT NULL"],
  ["token_lembrete", "char(36) DEFAULT NULL"],
];

const migracao: Migracao = {
  nome: "0002-lembretes-sacola",
  up: async (banco) => {
    for (const [nome, definicao] of colunas) {
      const [existe] = await banco.query(`SHOW COLUMNS FROM \`carrinhos\` LIKE '${nome}'`);
      if ((existe as unknown[]).length === 0) {
        await banco.query(`ALTER TABLE \`carrinhos\` ADD COLUMN \`${nome}\` ${definicao}`);
      }
    }

    const [indice] = await banco.query("SHOW INDEX FROM `carrinhos` WHERE Key_name = 'UQ_CARRINHOS_TOKEN_LEMBRETE'");
    if ((indice as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `carrinhos` ADD UNIQUE KEY `UQ_CARRINHOS_TOKEN_LEMBRETE` (`token_lembrete`)");
    }

    await banco.query(`CREATE TABLE IF NOT EXISTS \`sacola_lembretes_cancelados\` (
  \`id_usuario\` int NOT NULL,
  \`data_cancelamento\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id_usuario\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
  },
};

export default migracao;
