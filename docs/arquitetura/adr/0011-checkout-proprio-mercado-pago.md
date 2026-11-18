# ADR 0011: Checkout próprio com pagamento pelo Mercado Pago

- **Status:** Aceito
- **Data:** 2026-11-13
- **Substitui:** [ADR 0009](0009-shopify-headless.md) (Shopify headless) e [ADR 0010](0010-remocao-do-painel-admin.md) (remoção do painel)

## Contexto

O [ADR 0009](0009-shopify-headless.md) levou vitrine, sacola, checkout e pagamento para o Shopify, e o [ADR 0010](0010-remocao-do-painel-admin.md) removeu o painel `/admin`, que tinha ficado sem função. A loja decidiu não seguir com o Shopify: os produtos, a sacola e os pedidos voltam a ser dos próprios serviços (`catalogo`, `carrinho`, `pedidos`), geridos pelo painel administrativo. Faltava o que motivou o Shopify: receber o pagamento pelo site (US-25 e US-26 do backlog).

## Decisão

- **Shopify desativado, não apagado.** O serviço `loja` sai dos workspaces, do `docker-compose`, do gateway e do CD; as variáveis `SHOPIFY_*` ficam comentadas, e as telas que usavam o serviço estão em `agnus-front/shopify-desativado/`. Para religar, ver `services/loja/README.md`.
- **Painel `/admin` de volta**, como antes do ADR 0010: site `agnus-admin-front` e serviço `admin`.
- **Checkout próprio com o Mercado Pago (Checkout Transparente, Payment Brick).** Depois de escolher o endereço, o pedido nasce `aguardando_pagamento` e o cliente paga em `/pagamento/<pedido>` com PIX ou cartão de crédito (até 12x), sem sair do site.
- **O pagamento mora no serviço `pedidos`**, que já é dono do status do pedido: tabela `pagamentos` (uma linha por tentativa), rotas `POST/GET /orders/:id/pagamento`, `GET /pagamentos/config` e o webhook `POST /pagamentos/webhook`. O módulo `src/pagamentos/mercadoPago.ts` é a camada anticorrupção: só ele conhece a API e os status do Mercado Pago.

### Regras

- O valor cobrado vem sempre do pedido gravado (`valor_total + valor_frete`); o valor que o navegador manda é ignorado.
- Os dados do cartão ficam nos iframes do Mercado Pago; o servidor recebe só um token de uso único. O corpo enviado ao Mercado Pago nunca vai para o log.
- Cada cobrança leva uma chave de idempotência (`X-Idempotency-Key`) e o número do pedido em `external_reference`. Um PIX ainda válido do mesmo pedido é reaproveitado, em vez de gerar outra cobrança.
- O pedido só vira `pago` quando o Mercado Pago diz `approved` **e** a referência, o valor e a moeda (BRL) batem com o pedido. Estorno (`refunded`, `charged_back`) de pedido pago vira `cancelado`. Recusa mantém o pedido aguardando, para o cliente tentar de novo.
- Webhook: só com a chave secreta configurada; a assinatura `x-signature` (HMAC-SHA256 de `id;request-id;ts`) é conferida em tempo constante e notificações com mais de 10 minutos são recusadas. O corpo da notificação não é confiável: o pagamento é sempre buscado de novo na API do Mercado Pago.
- Sem webhook (localhost), a consulta `GET /orders/:id/pagamento` pergunta ao Mercado Pago quando o último pagamento está pendente.
- A mudança para `pago` reusa o aviso ao cliente e o evento `pedido.atualizado` que já existiam.
- Só o serviço `pedidos` recebe `MP_ACCESS_TOKEN` e `MP_WEBHOOK_SECRET`; a CSP do site libera apenas os domínios do SDK e da API do Mercado Pago.

## Alternativas descartadas

- **Checkout Pro (redirecionar para o site do Mercado Pago):** mais simples, mas tira o cliente da loja; o pedido era um checkout próprio.
- **Serviço `pagamentos` separado:** mais isolamento, mas exigiria outro banco, outra imagem e uma saga entre dois serviços para algo que hoje só muda o status do pedido. Fica como próxima extração, se o volume justificar.
- **Formulário de cartão próprio:** traria o número do cartão para o nosso servidor (escopo PCI). O Brick tokeniza no navegador.

## Consequências

- O pedido passa a ser pago no site; o cliente acompanha em "Meus pedidos" e recebe a notificação de pago.
- A loja precisa de uma aplicação no painel de desenvolvedores do Mercado Pago (credenciais e webhook). Sem elas, a tela de pagamento avisa que o pagamento online não está disponível.
- Frete continua fora do cálculo automático (`valor_frete` entra no total quando a equipe preenche).
