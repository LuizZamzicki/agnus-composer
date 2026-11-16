import type { Migracao } from "@agnus/comum/utils/migracoes";

// Tabela de medidas da peça (guia "Ver medidas" na página do produto). JSON com o modelo da peça,
// as colunas (ex.: largura, comprimento, manga) e os valores em cm por tamanho. Vazio = sem guia.
const migracao: Migracao = {
  nome: "0003-tabela-medidas",
  up: async (banco) => {
    const [colunas] = await banco.query("SHOW COLUMNS FROM `produtos` LIKE 'tabela_medidas'");

    if ((colunas as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `produtos` ADD COLUMN `tabela_medidas` json DEFAULT NULL AFTER `preco_original`");
    }
  },
};

export default migracao;
