# ADR 0010: Remoção do painel administrativo (/admin)

- **Status:** Substituído pelo [ADR 0011](0011-checkout-proprio-mercado-pago.md)
- **Data:** 2026-11-13
- **Substitui em parte:** [ADR 0008](0008-microsservicos.md), quanto ao serviço `admin` (BFF) e ao site `agnus-admin-front`

## Contexto

Com o [ADR 0009](0009-shopify-headless.md), produtos, estoque, preços, pedidos e pagamento passaram a ser geridos no Shopify. O painel `/admin` do projeto continuava cadastrando produtos e acompanhando pedidos nos serviços `catalogo` e `pedidos`, que deixaram de alimentar a vitrine. Isso deixava dois lugares para a mesma tarefa, com o do projeto desatualizado em relação à loja real.

O painel também mantinha um site separado (`agnus-admin-front`), um serviço próprio (`admin`, BFF do dashboard, métricas consolidadas e Swagger) e desvios no site do cliente: contas de administrador iam para `/admin`, não tinham sacola e não podiam comprar.

## Decisão

O painel administrativo deixa de existir. O site trabalha apenas com a área do cliente (`/cliente`).

- Removidos o site `agnus-admin-front` e o serviço `admin`, com suas imagens no CD e o job no CI.
- O gateway responde `/admin` (e qualquer caminho abaixo dele) com um redirecionamento 301 para `/cliente`. O site do cliente faz o mesmo para navegação interna.
- `/api/health` passa a vir do serviço `loja`, que sustenta vitrine e checkout. É o que o deploy confere.
- Toda conta usa o site como cliente: o perfil `administrador` continua existindo no banco, mas no site ele entra, monta a sacola e compra como qualquer cliente.
- A gestão da loja (produtos, pedidos, clientes, relatórios) é feita no admin do Shopify.

## Alternativas descartadas

- **Manter o painel só para leitura:** continuaria mostrando dados dos serviços antigos, que não refletem a loja do Shopify.
- **Refazer o painel sobre a Admin API do Shopify:** duplicaria o que o admin do Shopify já oferece, com mais código e mais credenciais para proteger.

## Consequências

- Menos superfície de ataque: um site, um serviço e uma credencial de alto privilégio a menos.
- Saem também `/api/admin/dashboard`, `/api/metrics` (consolidado) e `/api/docs` (Swagger agregado). As especificações de cada serviço seguem em `/api/specs/<servico>.json`, e cada serviço mantém o próprio `/metrics` interno.
- As rotas administrativas dos serviços `catalogo`, `pedidos` e `identidade` continuam na API, protegidas por perfil, mas sem interface. Podem ser removidas quando esses serviços forem desativados.
