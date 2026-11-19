import type { Migracao } from "@agnus/comum/utils/migracoes";

// Desconto de quem pagou no Pix. Fica separado do cupom (valor_desconto) e entra no pedido só
// quando o Pix é aprovado: até lá o cliente ainda pode escolher o cartão, que cobra o total cheio.
const migracao: Migracao = {
  nome: "0010-desconto-pix",
  up: async (banco) => {
    const [existe] = await banco.query("SHOW COLUMNS FROM `pedidos` LIKE 'valor_desconto_pix'");
    if ((existe as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `pedidos` ADD COLUMN `valor_desconto_pix` decimal(10,2) NOT NULL DEFAULT 0.00 AFTER `valor_desconto`");
    }
  },
};

export default migracao;
