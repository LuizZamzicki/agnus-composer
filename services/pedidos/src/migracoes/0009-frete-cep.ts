import type { Migracao } from "@agnus/comum/utils/migracoes";

// Frete calculado pelo CEP no checkout: guarda qual opção o cliente escolheu (PAC, SEDEX, Jadlog...)
// e o prazo prometido, além do valor que já ia em valor_frete.
const colunas: [string, string][] = [
  ["frete_servico", "varchar(80) DEFAULT NULL AFTER `frete_gratis`"],
  ["frete_prazo_dias", "smallint DEFAULT NULL AFTER `frete_servico`"],
];

const migracao: Migracao = {
  nome: "0009-frete-cep",
  up: async (banco) => {
    for (const [nome, definicao] of colunas) {
      const [existe] = await banco.query(`SHOW COLUMNS FROM \`pedidos\` LIKE '${nome}'`);
      if ((existe as unknown[]).length === 0) {
        await banco.query(`ALTER TABLE \`pedidos\` ADD COLUMN \`${nome}\` ${definicao}`);
      }
    }
  },
};

export default migracao;
