import type { Migracao } from "@agnus/comum/utils/migracoes";

// Categoria "fornecedor" no registro de eventos: pedidos criados na YouDraw, falhas e status de lá.
const migracao: Migracao = {
  nome: "0003-registro-fornecedor",
  up: async (banco) => {
    await banco.query(
      "ALTER TABLE `registro_eventos` MODIFY `categoria` enum('pedido','pagamento','devolucao','email','aviso','catalogo','usuario','afiliado','fornecedor','sistema') NOT NULL",
    );
  },
};

export default migracao;
