# Product Backlog — Agnus

**Ordenação:** do mais para o menos prioritário dentro de cada release aberta. **Priorização:** MoSCoW (*Must / Should / Could / Won't*) + valor de negócio ÷ esforço. **Estimativa:** story points (Fibonacci). **Status:** ✅ Concluído · 🔄 Em andamento · 📋 A fazer · ⛔ Descartado/repensado.

Rastreabilidade: cada história referencia os requisitos funcionais (RF) do [readme](../../readme.md) e vira uma issue no Jira com a mesma chave ([como importar](jira.md)).

## Visão geral por épico

| Épico | Objetivo | Histórias | Status |
| --- | --- | --- | --- |
| **EP-01** Identidade e Acesso | Cliente e equipe entram com segurança e só fazem o que podem | US-01..06 | 5/6 ✅ |
| **EP-02** Catálogo | Cliente encontra a peça certa rapidamente | US-07..14 | 6/8 ✅ (1 descartada) |
| **EP-03** Carrinho | Cliente monta a compra com as variações corretas | US-15..16 | 2/2 ✅ |
| **EP-04** Pedidos e Checkout | Pedido correto dispara a produção sob demanda | US-17..24, US-29 | 7/9 ✅ (1 descartada) |
| **EP-05** Pagamento online | Cliente paga sem sair da loja | US-25..26 | 🔄 |
| **EP-06** Avaliações | Prova social para novos clientes | US-27 | ✅ |
| **EP-07** Painel administrativo | Equipe acompanha vendas e opera a loja | US-28 | 1/1 ✅ |
| **EP-08** Plataforma e Qualidade (*enablers*) | Base técnica confiável para evoluir rápido | TS-01..17 | 13/17 ✅ |

---

## Release 4.0.0 — Pagamento online e loja publicada (próxima, em andamento)

### US-25 · Pagar o pedido pelo Mercado Pago · `Must` · 8 pts · 🔄
**Como** cliente, **quero** pagar com Pix ou cartão sem sair da loja **para** concluir a compra com segurança.
**Critérios de aceite**
- **Dado** um pedido em `aguardando_pagamento`, **quando** escolho pagar, **então** sou levado ao checkout do Mercado Pago com o valor exato do pedido.
- **Dado** que o pagamento foi aprovado, **quando** volto à loja, **então** vejo a confirmação e o pedido aparece como `pago`.
- **Dado** que o pagamento foi recusado, **então** o pedido continua em `aguardando_pagamento` e posso tentar de novo.
- Nenhum dado de cartão trafega ou é armazenado no Agnus.
RF93

### US-26 · Confirmar pagamento por webhook · `Must` · 5 pts · 📋
**Como** equipe de vendas, **quero** que o status mude para `pago` automaticamente **para** iniciar a produção sem conferência manual.
**Critérios de aceite**
- Webhook do Mercado Pago com assinatura válida atualiza o pedido para `pago` e publica `pedido.atualizado`.
- Webhook com assinatura inválida retorna 401 e não altera nada.
- O mesmo webhook recebido duas vezes não duplica efeitos (idempotência pelo id do pagamento).
- O evento de pagamento usa fila durável (Redis Streams), não Pub/Sub ([ADR 0004](../arquitetura/adr/0004-eventos-redis-pubsub.md)).

### TS-16 · Publicar a loja em um endereço público · `Must` · 5 pts · 📋
**Como** equipe, **quero** a loja acessível na internet **para** que clientes e avaliadores usem a versão real.
**Critérios de aceite**
- Servidor com `docker compose` e certificado válido (Let's Encrypt).
- Segredos `DEPLOY_HOST`, `DEPLOY_USER` e `DEPLOY_SSH_KEY` no ambiente `producao` do GitHub; uma tag `vX.Y.Z` publica a nova versão com rollback automático (`cd.yml`).
- Link público registrado no readme.

### TS-17 · Integrar Jira e GitHub · `Should` · 1 pt · 📋
- App *GitHub for Jira* instalado; branches, commits e PRs citam `AGNUS-<n>`.

### US-24 · Notificar o cliente por e-mail sobre o status · `Should` · 5 pts · 📋
**Como** cliente, **quero** receber um e-mail quando meu pedido mudar de status **para** acompanhar a entrega sem entrar no site.
**Critérios de aceite**
- O worker consome `pedido.atualizado` e envia e-mail com o novo status.
- Falha no envio é registrada em log e não afeta o pedido.
- *Base pronta:* o handler `notificacao.cliente` já existe no worker (hoje só registra em log).

### US-06 · Cargos vendas, atendimento e auditor · `Could` · 5 pts · 📋
**Como** administrador, **quero** dar acesso parcial à equipe **para** que cada pessoa veja só o necessário.
**Critérios de aceite**
- Novos cargos em `ROLE_PERMISSIONS` com permissões específicas (ex.: auditor só lê pedidos).
- Usuário de cargo sem permissão recebe 403.
RF07, RF08

### US-13 · Produtos em destaque na home · `Could` · 3 pts · 📋
**Como** dono da loja, **quero** marcar produtos como destaque **para** promover lançamentos.
**Critérios de aceite**
- Campo `destaque` no produto, editável no painel.
- A home lista até 8 produtos em destaque, usando o cache do catálogo.
RF23, RF27

### US-30 · Coleções por tempo litúrgico · `Could` · 8 pts · 📋 (quando houver mais estampas)
**Como** cliente, **quero** ver coleções ligadas ao tempo litúrgico (Advento, Quaresma, Páscoa…) **para** viver o ano da Igreja também no que visto.
**Critérios de aceite**
- Faixa do calendário litúrgico na página inicial mostrando o ano da Igreja e o tempo atual, clicável.
- Cada tempo pode ter uma coleção própria; a página inicial destaca a coleção do tempo atual.
- Ideia validada no protótipo de comparação de direções visuais (2026-11-02); adiada porque hoje existe apenas uma estampa.

### US-14 · Cadastro de marcas · `Won't (por ora)` · — · ⛔
**Motivo:** todas as peças são da própria marca Agnus. Volta ao backlog se a loja passar a revender outras marcas.
RF33–RF36, RF40

### US-29 · Controle de estoque por variação · `Won't (repensado)` · — · ⛔
**Motivo:** no modelo **print on demand**, as peças são produzidas depois do pedido, então não existe estoque físico a controlar. Os requisitos RF24–RF26, RF56–RF57 e RF97 foram substituídos pela regra "a variante (cor + grade) precisa existir e o produto precisa estar ativo" (RF55). ✅ RFs marcados como substituídos no readme.

---

## Release 3.4.0 — Regras do pedido e endurecimento ✅ (2026-11-06)

### US-22 · Total do pedido calculado no servidor · `Must` · 5 pts · ✅
**Como** dono da loja, **quero** que o valor total seja calculado pela API **para** impedir que alguém altere o preço pelo navegador.
**Critérios de aceite**
- ✅ `valor_total` = soma de (preço da variante × quantidade) + frete, calculado no backend (`CheckoutService` e `PedidoRegrasService.recalcularTotal`).
- ✅ Um `valor_total` enviado pelo cliente é ignorado; `POST /orders` passou a ser lançamento manual exclusivo da equipe.
- ✅ Pedido e itens são criados na **mesma transação**: se um item falhar, nada é gravado.
- ✅ Incluir, alterar ou remover item, ou mudar o frete, refaz o total.
RF60, RF64

### US-23 · Transições de status válidas · `Should` · 3 pts · ✅
**Como** equipe, **quero** que o sistema impeça transições impossíveis (ex.: `entregue → aguardando_pagamento`) **para** manter o histórico confiável.
**Critérios de aceite**
- ✅ Transições permitidas: `aguardando_calculo_frete → aguardando_pagamento → pago → enviado → entregue`; `cancelado` só antes de `enviado`.
- ✅ Transição inválida retorna 409 com mensagem clara (`Transicao de status invalida: entregue -> aguardando_pagamento.`).
- ✅ Itens só mudam enquanto o pedido está aberto.
RF69, RF70

### TS-12 · Rotas da API por bounded context · `Should` · 2 pts · ✅
- ✅ `app.ts` dividido em `src/routes/*.routes.ts` (identidade, clientes, catálogo, avaliações, carrinho, pedidos).
- ✅ A coleção Postman é gerada a partir desses módulos.

### TS-13 · Endurecer o Nginx · `Should` · 2 pts · ✅
- ✅ Upstream com keepalive, timeouts de proxy, gzip e cache dos estáticos com hash.
- ✅ *Rate limit* no login: acima de 10/min por IP responde 429.
- ✅ A porta 3000 da API fica só em `127.0.0.1`.

### TS-14 · Tags SemVer e Releases no GitHub · `Must` · 1 pt · ✅
- ✅ Tags anotadas `v2.0.0` a `v3.4.0` e uma Release por versão, com as notas do CHANGELOG ([versionamento](versionamento.md)).

### TS-15 · Roteiro de validação da rubrica · `Should` · 1 pt · ✅
- ✅ [docs/validacao-rubrica.md](../validacao-rubrica.md) e `npm run validar:rubrica` (16 verificações automáticas contra a stack).

**Bugs corrigidos nesta release** (detalhes no [`jira-import.csv`](jira-import.csv)): CI vermelho após remover o `node_modules`; cliente criando pedido com valor e status próprios; cliente incluindo itens depois do checkout; cache não invalidado ao editar cor/grade; worker perdendo o primeiro evento após reiniciar.

---

## Release 3.3.0 — Desempenho, observabilidade e nova identidade ✅ (2026-11-03)

### US-12 · Catálogo rápido mesmo com muitos acessos · `Must` · 8 pts · ✅
**Como** cliente, **quero** que o catálogo abra rápido **para** não desistir da compra.
**Critérios de aceite**
- ✅ Leituras de catálogo, detalhe, mais vendidos e categorias usam cache Redis com TTL.
- ✅ Depois de o admin editar um produto, categoria ou foto, a próxima leitura já mostra o dado novo.
- ✅ Se o Redis cair, o catálogo continua funcionando, direto do banco.
- ✅ p95 do catálogo < 150 ms (medido: **10 ms** com cache).

### US-19 · Avisar a equipe sobre pedidos novos · `Should` · 5 pts · ✅
**Como** equipe de vendas, **quero** ser avisada de cada pedido novo **para** iniciar a produção sob demanda.
**Critérios de aceite**
- ✅ Criar ou alterar pedido publica evento no Redis Pub/Sub.
- ✅ Um worker separado consome o evento e registra `notificacao.equipe_vendas` / `notificacao.cliente`.
- ✅ Falha no Redis não impede a criação do pedido.

### TS-06 · Logs estruturados e métricas · `Must` · 5 pts · ✅
- ✅ Logs JSON com `requestId` propagado do Nginx até o worker.
- ✅ Erros 500 registrados com stack.
- ✅ `GET /metrics` com latência p50/p95/p99, disponibilidade e taxa de acerto do cache.

### TS-07 · Documentação da API (OpenAPI) · `Should` · 3 pts · ✅
- ✅ `openapi.yaml` com os principais endpoints; Swagger UI em `/api/docs/`.

### TS-08 · Pipeline de entrega contínua · `Should` · 3 pts · ✅
- ✅ `cd.yml`: testes → imagens versionadas no GHCR → deploy com rollback automático.

### TS-11 · Aplicação do logotipo oficial no site · `Should` · — · ✅
- Logo oficial (cordeiro com auréola e estandarte) aplicado no cabeçalho, rodapé, login, página 404, painel e ícones do site.
- Arte original guardada em `docs/marca/`; versões otimizadas em `agnus-front/src/img/marca/`.

### TS-09 · Migrar `sequelize.sync` para migrations · `Should` · 5 pts · 📋 (release 4.0.0)
- Schema versionado em migrations; deploy roda `db:migrate` antes de subir a nova versão.

### TS-10 · Métricas no Prometheus/Grafana · `Could` · 5 pts · 📋
- `/metrics` em formato Prometheus; painel com os SLOs.

---

## Release 3.2.x — Upload e administração ✅ (2026-09-17)

### US-08 · Enviar fotos reais dos produtos · `Must` · 5 pts · ✅
**Como** administrador, **quero** enviar fotos do computador **para** mostrar as estampas com fidelidade.
- ✅ Upload multipart via Multer; JPEG, PNG, GIF, WebP e BMP, com o formato conferido pelos *magic bytes*; até 20 MB.
- ✅ Arquivo inválido retorna 400 com mensagem clara.
RF17–RF19

### US-04 · Separar o que o cliente e o admin podem fazer · `Must` · 5 pts · ✅
**Como** dono da loja, **quero** que só administradores alterem produtos e pedidos **para** proteger a loja.
- ✅ Rotas administrativas exigem JWT + permissão (`checarPermissao`).
- ✅ Cliente só vê e edita os próprios dados e pedidos.
RF08–RF09, RF108–RF113

### TS-05 · Túnel público com ngrok no Compose · `Could` · 2 pts · ✅
- ✅ `ngrok` sobe junto com a stack para o callback OAuth e o app mobile.

## Release 3.1.0 — Catálogo e documentação ✅ (2026-09-16)

### US-10 · Ordenar o catálogo por preço · `Should` · 3 pts · ✅
- ✅ `?sort=preco_asc|preco_desc` no catálogo; a ordenação persiste na paginação.

### TS-04 · Requisitos funcionais e não funcionais documentados · `Must` · 3 pts · ✅

## Release 3.0.0 — Mobile ✅ (2026-09-08)

### US-03 · Entrar com a conta Google (web e app) · `Should` · 5 pts · ✅
**Como** cliente, **quero** entrar com o Google **para** não criar mais uma senha.
- ✅ Fluxo OAuth 2.0 com `state` assinado.
- ✅ O app mobile informa um `redirect` (validado por allowlist) e recebe o token.
- ✅ Conta existente com o mesmo e-mail é vinculada, não duplicada.

## Release 2.x — E-commerce ✅ (2026-06-16 → 2026-08-31)

| ID | História | Pri. | Pts | Critérios de aceite (resumo) | RF |
| --- | --- | --- | --- | --- | --- |
| US-01 | Como visitante, quero me cadastrar para comprar | Must | 3 | E-mail único; senha forte validada; CPF válido | RF01 |
| US-02 | Como cliente, quero entrar com e-mail e senha | Must | 3 | JWT válido por `JWT_EXPIRES_IN`; mensagem genérica para credenciais erradas | RF02–RF04 |
| US-05 | Como cliente, quero trocar minha senha | Should | 3 | Exige a senha atual; não aceita as últimas senhas usadas | RF06 |
| US-07 | Como admin, quero cadastrar produto com cores, grades e fotos | Must | 8 | Tudo numa transação; precisa de ao menos uma cor com foto | RF12–RF14 |
| US-09 | Como cliente, quero buscar produtos mesmo digitando errado | Should | 5 | Meilisearch com sinônimos; fallback SQL | RF43–RF45 |
| US-11 | Como cliente, quero filtrar por categoria | Must | 2 | `?id_categoria=`; paginação | RF38–RF39 |
| US-15 | Como cliente, quero adicionar peças ao carrinho escolhendo cor e tamanho | Must | 5 | Valida que a cor e a grade pertencem ao produto | RF49, RF52 |
| US-16 | Como cliente, quero alterar quantidades e remover itens | Must | 3 | Subtotal e total recalculados | RF50–RF54 |
| US-17 | Como cliente, quero finalizar a compra escolhendo o endereço | Must | 5 | Endereço precisa ser do cliente; pedido nasce em `aguardando_pagamento` | RF60–RF63, RF89–RF96 |
| US-18 | Como cliente, quero ver meu histórico de pedidos | Must | 3 | Só os meus pedidos; detalhes com itens | RF65–RF66 |
| US-20 | Como admin, quero atualizar o status dos pedidos | Must | 3 | Permissão `pedidos:atualizar`; filtro por status | RF67–RF74 |
| US-21 | Como cliente, quero cadastrar vários endereços | Must | 3 | CRUD; um principal | RF77–RF83 |
| US-27 | Como cliente, quero avaliar produtos com nota e fotos | Should | 5 | Só com pedido entregue; uma por produto; nota de 1 a 5; fotos opcionais | — |
| US-28 | Como admin, quero um painel com pedidos e mais vendidos | Should | 5 | Totais de pedidos; mais vendidos | RF98–RF102 |
| TS-01 | Docker Compose com Nginx, TLS e redes isoladas | Must | 5 | `docker compose up` sobe tudo; dados em rede interna | RNF15, RNF42 |
| TS-02 | Husky + ESLint + Commitlint | Should | 2 | Commit fora do padrão é bloqueado | — |
| TS-03 | CI no GitHub Actions + template de PR | Must | 3 | PR roda lint, testes e build | — |
