# Serviço `loja` (Shopify headless) — DESATIVADO

Este serviço era o BFF da Storefront e da Admin API do Shopify: vitrine, sacola, checkout e "Meus pedidos" vinham do Shopify ([ADR 0009](../../docs/arquitetura/adr/0009-shopify-headless.md)). A loja voltou a usar os próprios serviços `catalogo`, `carrinho` e `pedidos`, com checkout próprio e pagamento pelo Mercado Pago ([ADR 0011](../../docs/arquitetura/adr/0011-checkout-proprio-mercado-pago.md)).

O código fica guardado aqui, mas está desligado:

- fora dos workspaces em `services/package.json` (não compila nem roda testes);
- comentado no `docker-compose.yml`, no `docker-compose.prod.yml`, no gateway (`gateway/nginx.conf` e `gateway/rotas.conf`) e no CD (`.github/workflows/cd.yml`);
- as variáveis `SHOPIFY_*` estão comentadas em `services/.env.example`;
- as telas do site que usavam este serviço estão em `agnus-front/shopify-desativado/`.

## Como religar

1. Volte `"loja"` para os `workspaces` de `services/package.json` e rode `npm install`.
2. Descomente os blocos marcados com "Shopify headless DESATIVADO" nos arquivos acima.
3. Preencha as variáveis `SHOPIFY_*` em `services/.env`.
4. Traga as telas de `agnus-front/shopify-desativado/` de volta para `agnus-front/src/`.
