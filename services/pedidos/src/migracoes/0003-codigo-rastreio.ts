import type { Migracao } from "@agnus/comum/utils/migracoes";

// Código de rastreio da YouDraw (UUID). A URL de acompanhamento é montada a partir dele.
const migracao: Migracao = {
  nome: "0003-codigo-rastreio",
  up: async (banco) => {
    const [colunas] = await banco.query("SHOW COLUMNS FROM `pedidos` LIKE 'codigo_rastreio'");

    if ((colunas as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `pedidos` ADD COLUMN `codigo_rastreio` varchar(36) DEFAULT NULL AFTER `valor_frete`");
    }
  },
};

export default migracao;
