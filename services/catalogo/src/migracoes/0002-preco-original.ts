import type { Migracao } from "@agnus/comum/utils/migracoes";

// Preço "De" das promoções: quando preenchido (e maior que preco_base), a vitrine mostra
// "De R$ preco_original por R$ preco_base". O valor cobrado continua sendo sempre o preco_base.
const migracao: Migracao = {
  nome: "0002-preco-original",
  up: async (banco) => {
    const [colunas] = await banco.query("SHOW COLUMNS FROM `produtos` LIKE 'preco_original'");

    if ((colunas as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `produtos` ADD COLUMN `preco_original` decimal(10,2) DEFAULT NULL AFTER `preco_base`");
    }
  },
};

export default migracao;
