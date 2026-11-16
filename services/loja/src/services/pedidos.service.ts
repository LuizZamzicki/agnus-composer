import { consultarOuNull } from "@agnus/comum/utils/clienteInterno";
import logger from "@agnus/comum/utils/logger";
import { CACHE_TTL } from "../config";
import { consultarAdmin } from "../shopify/admin";
import { normalizarPedido, pedidoDoCliente, PEDIDOS_DO_CLIENTE, type PedidoShopify } from "../shopify/pedidos";
import { comCache } from "./cache";
import type { Comprador } from "./sacola.service";

// Aspas e barras no e-mail quebrariam a sintaxe de busca do Shopify.
const buscaPorEmail = (email: string) => `email:"${email.replace(/["\\]/g, "")}"`;

// Na dúvida (identidade fora do ar), trata o e-mail como não comprovado: só some o pedido sem marca.
const emailComprovado = async (idUsuario: number) => {
  try {
    const usuario = await consultarOuNull<{ email_verificado?: boolean }>("identidade", `/usuarios/${idUsuario}`);
    return usuario?.email_verificado === true;
  } catch {
    return false;
  }
};

// "Meus pedidos": as compras feitas no checkout do Shopify. O checkout recebe o e-mail da conta já
// preenchido (buyerIdentity) e o id da conta num atributo oculto da sacola.
export const listarPedidos = (comprador: Comprador) =>
  comCache(`pedidos:usuario:${comprador.id_usuario}`, CACHE_TTL.pedidos, async () => {
    const [dados, emailVerificado] = await Promise.all([
      consultarAdmin<{ orders: { nodes: PedidoShopify[] } }>(PEDIDOS_DO_CLIENTE, { busca: buscaPorEmail(comprador.email) }),
      emailComprovado(comprador.id_usuario),
    ]);

    const dono = { idUsuario: comprador.id_usuario, email: comprador.email, emailVerificado };
    const daConta = dados.orders.nodes.filter((pedido) => pedidoDoCliente(pedido, dono));

    // Ajuda a entender "comprei e não aparece": quantos a busca achou e quantos ficaram de fora.
    logger.info("loja.pedidos_listados", {
      id_usuario: comprador.id_usuario,
      encontrados: dados.orders.nodes.length,
      exibidos: daConta.length,
      emailVerificado,
    });

    return daConta.map(normalizarPedido);
  });
