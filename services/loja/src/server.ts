import "dotenv/config";
import logger from "@agnus/comum/utils/logger";
import { iniciarServico } from "@agnus/comum/utils/servico";
import app from "./app";
import { adminConfigurado } from "./shopify/admin";
import { lojaConfigurada } from "./shopify/cliente";

// Sem credenciais o serviço sobe mesmo assim (o healthcheck não derruba a stack), mas avisa.
if (!lojaConfigurada()) {
  logger.warn("loja.shopify_nao_configurado", {
    variaveis: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_PRIVATE_TOKEN ou SHOPIFY_STOREFRONT_PUBLIC_TOKEN"],
  });
}

// Sem a Admin API, a loja vende normalmente, mas "Meus pedidos" não mostra as compras do Shopify.
if (!adminConfigurado()) {
  logger.warn("loja.admin_nao_configurado", {
    variaveis: ["SHOPIFY_ADMIN_CLIENT_ID + SHOPIFY_ADMIN_CLIENT_SECRET ou SHOPIFY_ADMIN_TOKEN"],
  });
}

void iniciarServico({ app });
