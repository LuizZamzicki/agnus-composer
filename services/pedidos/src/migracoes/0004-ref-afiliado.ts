import type { Migracao } from "@agnus/comum/utils/migracoes";

// Cookie de clique de afiliado (assinado pelo serviço afiliados) que veio junto no checkout.
// Fica no pedido para a reconciliação refazer a atribuição se o aviso na hora falhar.
const migracao: Migracao = {
  nome: "0004-ref-afiliado",
  up: async (banco) => {
    const [colunas] = await banco.query("SHOW COLUMNS FROM `pedidos` LIKE 'ref_afiliado'");

    if ((colunas as unknown[]).length === 0) {
      await banco.query("ALTER TABLE `pedidos` ADD COLUMN `ref_afiliado` varchar(200) DEFAULT NULL AFTER `codigo_rastreio`");
    }
  },
};

export default migracao;
