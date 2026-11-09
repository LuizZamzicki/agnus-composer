# Como validar cada item da rubrica

Roteiro para conferir, item por item, que o Agnus atende à rubrica. Para cada item há **onde está**, **como verificar** e **o que esperar**. Os resultados citados vêm de uma execução real em 2026-11-06.

## Preparação (uma vez)

```bash
git clone https://github.com/LuizZamzicki/agnus-composer && cd agnus-composer
cp .env.example .env && cp agnus-back/.env.example agnus-back/.env   # preencha as senhas
# certificado local em certs/agnus.pem e certs/agnus-key.pem (ver readme, seção Docker)
docker compose up -d --build
docker compose ps            # backend, mysql, redis e nginx "healthy"; worker e meilisearch "Up"
```

**Verificação automática dos itens de back-end** (cria um cliente e um admin de teste, roda os fluxos e os remove):

```bash
cd agnus-back && npm run validar:rubrica
```

Saída esperada (execução real):

```text
OK   [Cache Redis] 1ª leitura = cache.miss -> requestId e0349753
OK   [Cache Redis] 2ª leitura = cache.hit -> requestId 6b9dcdd2
OK   [Cache Redis] chave com TTL -> TTL 120s (config 120s)
OK   [Cache Redis] update de cor invalida o cache de produtos -> PUT 200; chaves restantes: 0
OK   [Boas práticas / DDD] cliente NÃO cria pedido com valor/status próprios -> POST /orders -> 403
OK   [Boas práticas / DDD] cliente NÃO inclui itens depois do checkout -> POST /order-items -> 403
OK   [DDD (agregado Pedido)] checkout calcula o total no servidor -> pedido 10: total 299.8 = soma dos itens 299.80
OK   [Mensageria Pub/Sub] API publica pedido.criado -> receivers=1
OK   [Mensageria Pub/Sub] worker recebe com o mesmo requestId -> origemRequestId 8b8f484f
OK   [Mensageria Pub/Sub] worker grava a trilha de auditoria -> LRANGE agnus:auditoria:eventos 0 0
OK   [DDD (agregado Pedido)] transições válidas aceitas -> aguardando_pagamento->pago 200, pago->enviado 200
OK   [DDD (agregado Pedido)] transição inválida recusada -> 409 Transicao de status invalida: enviado -> aguardando_pagamento.
OK   [DDD (agregado Pedido)] itens não mudam depois do envio -> 409 Itens so podem ser alterados enquanto o pedido nao foi pago.
OK   [Mensageria Pub/Sub] worker notifica o cliente na mudança de status -> notificacao.cliente statusNovo=enviado
OK   [Docker Compose + Nginx] rate limit no login -> respostas: 401×4, 429×10
OK   [Observabilidade] /metrics para admin, 403 para cliente -> p95=123.61ms, cacheHitRatio=0.5, events_published=3

16/16 verificações OK
```

**Testes automatizados:** `cd agnus-back && npm test` (510 testes) · `cd agnus-front && CI=true npm test -- --watchAll=false` (39 testes). Os mesmos rodam no CI a cada PR.

---

## Arquitetura de Software (3,0)

### Documentação Arquitetural (0,5)

| Entregável | Onde | Como verificar | Esperado |
| --- | --- | --- | --- |
| C4 Contexto e Containers | [c4-contexto-containers.md](arquitetura/c4-contexto-containers.md) | Abrir no GitHub (o Mermaid é renderizado) | Diagrama de contexto (Cliente, Admin, Google, Mercado Pago, ngrok) e de containers igual aos serviços do `docker-compose.yml`; bônus: nível 3 (componentes da API) |
| ADRs | [adr/README.md](arquitetura/adr/README.md) | Ler o índice e o [ADR 0001](arquitetura/adr/0001-monolito-modular.md) | 7 ADRs no modelo Nygard; o 0001 decide **monólito modular vs. microsserviços/modulith**, com alternativas e consequências |
| Quality Scenarios | [quality-scenarios.md](arquitetura/quality-scenarios.md) | Conferir as 6 partes (fonte → medida) | 16 cenários (desempenho, disponibilidade, consistência, segurança, integridade, observabilidade, modificabilidade, testabilidade), cada um com a tática e onde verificar |

**Conferência prática:** o QS-03 (Redis cai e a API continua) pode ser reproduzido com `docker stop agnus-redis && curl -sk -o /dev/null -w '%{http_code}\n' https://localhost/api/products/catalog && docker start agnus-redis` → `200`.

### Estilos Arquiteturais e DDD (1,0)

| Entregável | Onde | Como verificar | Esperado |
| --- | --- | --- | --- |
| Domínios e subdomínios | [ddd.md § Domínio e subdomínios](arquitetura/ddd.md#domínio-e-subdomínios) | Ler a tabela | 8 subdomínios classificados em Core / Supporting / Generic, com justificativa |
| Bounded Contexts | [ddd.md § Bounded Contexts](arquitetura/ddd.md#bounded-contexts) + [`agnus-back/src/routes/`](../agnus-back/src/routes) | Comparar a tabela com os arquivos de rotas | 9 contextos; os 6 com API têm **um módulo de rotas cada** (`identidade`, `clientes`, `catalogo`, `avaliacoes`, `carrinho`, `pedidos`) |
| Context Map | [ddd.md § Context Map](arquitetura/ddd.md#context-map) | Ver o diagrama e a tabela de padrões | Customer/Supplier, Conformist, Open Host Service, Published Language e Anticorruption Layer, cada um apontando onde aparece no código |
| Entities, VOs e Aggregates | [ddd.md § Entities, Value Objects e Aggregates](arquitetura/ddd.md#entities-value-objects-e-aggregates) | Ler o diagrama do agregado **Pedido** e a tabela de invariantes | Aggregate Root, Entity e 5 Value Objects; **8 invariantes, todas ✅**, com a máquina de estados desenhada |

**Conferência prática das invariantes** (já coberta pelo `npm run validar:rubrica`): transição `enviado → aguardando_pagamento` retorna **409**, incluir item em pedido enviado retorna **409** e cliente tentando `POST /orders` retorna **403**. O código das regras fica em [`pedidoRegras.service.ts`](../agnus-back/src/services/pedidoRegras.service.ts).

### Integração, APIs e Dados (0,5)

| Entregável | Onde | Como verificar | Esperado |
| --- | --- | --- | --- |
| OpenAPI/Swagger | [`agnus-back/openapi.yaml`](../agnus-back/openapi.yaml) | Abrir <https://localhost/api/docs/> | Swagger UI com 37 caminhos e 50 operações em 13 grupos, autenticação Bearer e respostas de erro documentadas (incluindo 409 de transição de status) |
| ADR do banco | [ADR 0002](arquitetura/adr/0002-banco-de-dados-mysql.md) | Ler | MySQL justificado contra PostgreSQL, MongoDB e SQLite |
| Visão de integrações | [integracao-apis-dados.md](arquitetura/integracao-apis-dados.md) | Ler | Convenções (auth, paginação, erros, upload, `X-Request-Id`) e integrações externas com tratamento de falha |

Teste rápido: no Swagger, **Authorize** com um token de admin e execute `GET /orders`.

### Qualidade, Resiliência e Observabilidade (0,5)

| Entregável | Onde | Como verificar | Esperado |
| --- | --- | --- | --- |
| SLOs/SLIs | [slo-sli-resiliencia-observabilidade.md § 1](arquitetura/slo-sli-resiliencia-observabilidade.md#1-slis-e-slos) | Ler a tabela e o teste de carga | 7 SLOs com SLI, meta, janela, error budget e fonte; teste de carga com e sem cache (3.485 vs. 1.211 req/s) |
| Estratégias de resiliência | [§ 2](arquitetura/slo-sli-resiliencia-observabilidade.md#2-estratégias-de-resiliência-aplicadas) | Conferir no código citado | Timeout, retry com backoff, **circuit breaker**, fallback, bulkhead, health checks, rate limit no login |
| Plano de observabilidade | [§ 3](arquitetura/slo-sli-resiliencia-observabilidade.md#3-plano-de-observabilidade) | `curl -sk -H "Authorization: Bearer $TOKEN_ADMIN" https://localhost/api/metrics` | JSON com `latencyMs.p95`, `sli.availability`, `sli.cacheHitRatio` e contadores de eventos; tabela de logs e alertas no documento |

### Entrega Contínua (0,5)

| Entregável | Onde | Como verificar | Esperado |
| --- | --- | --- | --- |
| Pipeline CI/CD | [`ci.yml`](../.github/workflows/ci.yml) e [`cd.yml`](../.github/workflows/cd.yml) | GitHub → **Actions** | CI verde na `main` (lint, testes e build do back e do front, validação do compose); CD executado pela tag `v3.3.0` (testes → imagens no GHCR → deploy, pulado sem segredos) |
| Estratégia de deploy | [entrega-continua.md § 2](arquitetura/entrega-continua.md#2-estratégia-de-deploy) | Ler | *Recreate* com imagens versionadas e **rollback automático** por healthcheck; justificativa de não usar blue/green agora |
| Runbook | [runbook.md](operacao/runbook.md) | Ler | Primeiros 5 minutos, severidades P1–P3, procedimento por sintoma, rollback, restauração de backup e post-mortem |
| Versões publicadas | <https://github.com/LuizZamzicki/agnus-composer/releases> e **Packages** do repositório | Abrir | Releases `v2.0.0` a `v3.4.0` com notas do CHANGELOG; imagens `agnus-backend` e `agnus-frontend` publicadas pelo CD |

---

## Back-end Avançado (3,0)

### Cache distribuído com Redis (1,0)

Onde: [`cache.service.ts`](../agnus-back/src/services/cache.service.ts), [`config/cache.ts`](../agnus-back/src/config/cache.ts), usos em [`produtoCatalog.service.ts`](../agnus-back/src/services/produtoCatalog.service.ts) e [`categorias.controller.ts`](../agnus-back/src/controllers/categorias.controller.ts). Roteiro completo: [redis-cache-e-eventos.md](backend/redis-cache-e-eventos.md#roteiro-de-demonstração--5-min).

| Requisito | Como verificar | Esperado |
| --- | --- | --- |
| Cache-aside | `docker compose logs -f backend \| grep cache.` e chamar `curl -sk 'https://localhost/api/products/catalog?page=1&limit=10'` duas vezes | `cache.miss` e depois `cache.hit` com a mesma `key` |
| TTL | `docker exec agnus-redis redis-cli TTL 'agnus:cache:produtos:catalogo:limit=10&page=1'` | Número entre 1 e 120 (TTLs em `config/cache.ts`: 60 s a 600 s) |
| Invalidação em updates | Editar um produto, cor, grade, foto ou categoria no painel (ou `PUT /api/products/1`) e listar `redis-cli --scan --pattern 'agnus:cache:produtos:*'` | Log `cache.invalidado {namespace: produtos, removedKeys: N}`; nenhuma chave restante; a próxima leitura já traz o dado novo |

### Mensageria e assinatura de eventos (0,5)

Onde: [`eventBus.service.ts`](../agnus-back/src/services/eventBus.service.ts) (publica), [`worker.ts`](../agnus-back/src/worker.ts) (consome, container `worker`).

| Requisito | Como verificar | Esperado |
| --- | --- | --- |
| Publicar e consumir via Pub/Sub | Fazer uma compra na loja (ou mudar o status de um pedido no painel) com `docker compose logs -f backend worker \| grep -E 'evento\.\|notificacao\.'` aberto | API: `evento.publicado {type: pedido.criado, receivers: 1}`; worker: `evento.recebido` com o **mesmo** `requestId` e `notificacao.equipe_vendas` / `notificacao.cliente` |
| Prova independente da circulação | `docker exec -it agnus-redis redis-cli PSUBSCRIBE 'agnus.eventos.*'` e repetir a ação | A mensagem JSON aparece no terminal do `redis-cli` |
| Logs de comprovação | `docker exec agnus-redis redis-cli LRANGE agnus:auditoria:eventos 0 4` | Últimos eventos gravados pelo worker |

### Docker Compose e Nginx como proxy reverso (1,0)

Onde: [`docker-compose.yml`](../docker-compose.yml), [`nginx.conf`](../agnus-front/nginx.conf), [ADR 0006](arquitetura/adr/0006-nginx-proxy-reverso.md).

| Requisito | Como verificar | Esperado |
| --- | --- | --- |
| Orquestração | `docker compose ps` | 8 serviços; healthchecks; `depends_on: service_healthy`; redes `app` e `data` (esta `internal`) |
| Proxy reverso e TLS | `curl -sI http://localhost` e `curl -sk https://localhost/api/health` | `301` para HTTPS; `{"status":"ok"}` vindo do backend pelo `/api` |
| Só o Nginx exposto | `docker compose port backend 3000` e `curl -m 3 http://<IP-da-rede>:3000/health` | `127.0.0.1:3000`; conexão recusada pelo IP da rede |
| Cabeçalhos e rastreio | `curl -skI https://localhost/api/health` | `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, `X-Request-Id` |
| Rate limit, gzip e cache | 15 tentativas seguidas de `POST /api/auth/login`; `curl -skI -H 'Accept-Encoding: gzip' https://localhost/static/js/main.*.js` | `429` depois da rajada; `Content-Encoding: gzip` e `Cache-Control: max-age=31536000` |
| Configuração válida | `docker compose exec nginx nginx -t` | `syntax is ok` / `test is successful` |

### Boas práticas e observabilidade (0,5)

| Requisito | Onde | Esperado |
| --- | --- | --- |
| Módulos | [`src/routes/`](../agnus-back/src/routes) | Um módulo de rotas por bounded context; `app.ts` só monta middlewares, documentação e rotas |
| Controllers / services / DTOs | `src/controllers`, `src/services`, `src/types` | Controllers validam a entrada e montam a resposta; regras e transações nos services (`checkout`, `pedidoRegras`, `produtoMutation`, `cache`, `eventBus`); contratos `*Body`, `*Query`, `*RouteParams` |
| Logs claros por fluxo | `docker compose logs backend worker \| grep <X-Request-Id>` | Todas as linhas JSON de uma requisição, da API ao worker |
| Tratamento de erros | [`error.middleware.ts`](../agnus-back/src/middlewares/error.middleware.ts) | 400/409 para erros de validação e do banco, 500 sem detalhes internos e com `http.erro_nao_tratado` + stack no log. Teste: `curl -sk -X POST https://localhost/api/auth/login -H 'Content-Type: application/json' -d '{x'` → `400` |
| Testes | `npm test` | 510 testes no back-end, em 28 suítes |

---

## Tech Forge (3,0)

### Gestão do trabalho via Jira (1,0)

Este item **só se comprova no Jira**. O repositório traz o backlog pronto para importar e o guia de uso.

| O que mostrar | Como preparar | Onde está o material |
| --- | --- | --- |
| Issues de vários tipos (épico, história, task, bug) | Importar [`jira-import.csv`](gestao/jira-import.csv): 67 issues | [jira.md § Importar o backlog](gestao/jira.md#importar-o-backlog) |
| Atribuições | Coluna `Assignee` já preenchida (Luiz/Bruno); mapear na importação | idem |
| Atualização de status | Iniciar a `AGNUS Sprint 1` e mover os cards durante o trabalho | [jira.md § Rotina da equipe](gestao/jira.md#rotina-da-equipe) |
| Rastreabilidade com o código | Instalar *GitHub for Jira* e usar `AGNUS-<n>` em branches, commits e PRs | [jira.md § Ligação entre Jira e GitHub](gestao/jira.md#ligação-entre-jira-e-github) |
| Releases | Lançar as versões `2.0.0` a `3.4.0` no Jira | [versionamento.md](gestao/versionamento.md) |

**Evidências:** capturas listadas em [jira.md § Evidências](gestao/jira.md#evidências-para-a-avaliação), salvas em `docs/gestao/evidencias/`.

### Cynefin e escolha da abordagem (1,0)

| Entregável | Onde | Esperado |
| --- | --- | --- |
| Classificação | [cynefin.md § Classificação](gestao/cynefin.md#classificação-do-agnus) | Análise por dimensão (técnica, produto, canais, pagamento, equipe, incidentes) e conclusão: **Complexo** |
| Justificativa | idem, § Conclusão | A sequência catálogo → e-commerce → mobile → pagamento surgiu do aprendizado de cada versão |
| Abordagem | idem, § Abordagem | **Ágil (Scrumban)**, com o porquê de não ser preditivo nem híbrido, e as práticas de domínio complicado mantidas onde cabem (ADRs, runbook) |

### Ciclo de vida: backlog e versões (1,0)

| Entregável | Onde | Como verificar | Esperado |
| --- | --- | --- | --- |
| Product Backlog priorizado | [product-backlog.md](gestao/product-backlog.md) | Ler | Épicos com progresso; histórias *Como… quero… para…* com critérios de aceite *Dado/Quando/Então*; MoSCoW e story points; itens descartados com motivo |
| Versões parciais padronizadas | [versionamento.md](gestao/versionamento.md), [CHANGELOG](../CHANGELOG.md) | `git tag -l` e a página **Releases** do GitHub | SemVer + Conventional Commits; tags `v2.0.0` a `v3.4.0`, cada uma com Release e notas |
| Processo | [cynefin.md § Como o Scrumban é praticado](gestao/cynefin.md#como-o-scrumban-é-praticado) | Ler | Papéis, cerimônias, WIP, Definition of Ready e Definition of Done |

---

## Itens que dependem da equipe

| Item | O que fazer | Por quê |
| --- | --- | --- |
| Jira | Importar o CSV, iniciar a sprint, mover cards e tirar as capturas | A rubrica avalia o **uso** do Jira, que não dá para comprovar só com arquivos |
| Link do site | Publicar a stack num servidor (TS-16 no backlog) e preencher os segredos `DEPLOY_*` do ambiente `producao` | O cabeçalho da rubrica pede o link; hoje a stack roda localmente e o ngrok expõe só a API |
