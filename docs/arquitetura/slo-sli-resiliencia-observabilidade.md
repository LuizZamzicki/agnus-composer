# Atributos de Qualidade, Resiliência e Observabilidade

## 1. SLIs e SLOs

**SLI** (*Service Level Indicator*) é **o que** medimos. **SLO** (*Service Level Objective*) é **a meta** para essa medida numa janela de tempo. O **error budget** é quanto podemos falhar sem violar o SLO.

| # | Jornada / serviço | SLI (como medir) | SLO (meta) | Janela | Error budget | Fonte do dado |
| --- | --- | --- | --- | --- | --- | --- |
| SLO-1 | API como um todo | **Disponibilidade** = requisições não-5xx ÷ total | **≥ 99,5%** | 30 dias | 0,5% ≈ 3,6 h/mês | `GET /metrics` → `sli.availability`; logs `http.request` com `status` |
| SLO-2 | Catálogo (`/products/catalog`, `/products/:id`, `/categories`) | **Latência** p95 no backend | **p95 < 150 ms** e **p99 < 400 ms** | 7 dias | 5% das req. acima de 150 ms | `/metrics` → `latencyMs.p95/p99`; `durationMs` nos logs |
| SLO-3 | Login (`POST /auth/login`) | Latência p95 (inclui hash Argon2) | **p95 < 800 ms** | 7 dias | 5% | logs `http.request` filtrados por `path` |
| SLO-4 | Checkout (`POST /orders/checkout`) | **Taxa de sucesso** = 201 ÷ (201 + 5xx) | **≥ 99,9%** | 30 dias | 0,1% | logs `http.request` (`path=/orders/checkout`, `method=POST`) |
| SLO-5 | Cache | **Taxa de acerto** = hits ÷ (hits + misses) | **≥ 70%** em horário comercial | 1 dia | — (indicador de eficiência) | `/metrics` → `sli.cacheHitRatio` |
| SLO-6 | Consistência do catálogo | Tempo entre a edição pelo admin e a leitura pública atualizada | **0 s** (produto, cor, grade, foto, categoria); **≤ 60 s** (mais vendidos) | — | — | Teste em [redis-cache-e-eventos.md](../backend/redis-cache-e-eventos.md) |
| SLO-7 | Eventos | **Entrega** = `evento.recebido` (worker) ÷ `evento.publicado` (API) | **≥ 99%** com o worker no ar | 7 dias | 1% | contagem dos logs `evento.publicado` (API) e `evento.recebido` (worker) |

**Política do error budget:** se o budget de SLO-1 ou SLO-4 estourar no mês, novas features param e a sprint seguinte prioriza confiabilidade (correções, testes, alertas).

### Teste de carga

Medição local (MacBook, Docker/OrbStack), **200 produtos** no catálogo, `ab -k -n 3000 -c 20` em `GET /products/catalog?page=1&limit=24`, direto no backend:

| Cenário | Throughput | p50 | p95 | p99 | Erros |
| --- | --- | --- | --- | --- | --- |
| **Com cache Redis** (hit) | **3.485 req/s** | 5 ms | **10 ms** | 15 ms | 0 |
| Sem cache (Redis parado → fallback para MySQL) | 1.211 req/s | 12 ms | 34 ms | 112 ms | 0 |

O cache multiplicou o throughput por **≈ 2,9×** e reduziu o p99 **≈ 7×**. Com o Redis fora do ar, o sistema **continuou respondendo sem erros**, só mais devagar. Isso confirma o cenário QS-03 em [quality-scenarios.md](quality-scenarios.md).

## 2. Estratégias de resiliência aplicadas

| Estratégia | Onde | Como funciona |
| --- | --- | --- |
| **Timeout** | Redis (`src/config/redis.ts`) | `connectTimeout: 2000ms`, `commandTimeout: 500ms`: um Redis lento nunca segura a requisição por mais de 0,5 s |
| **Timeout** | Meilisearch | `waitForTask` com `timeout: 10000` |
| **Fail fast** | Redis | `enableOfflineQueue: false` e `maxRetriesPerRequest: 1`: sem conexão, o comando falha na hora em vez de enfileirar |
| **Retry com backoff** | Reconexão Redis | `retryStrategy: min(tentativa × 200ms, 5s)`: reconecta sozinho, sem martelar o servidor |
| **Circuit breaker** | `CacheService` | 5 falhas seguidas → circuito **aberto** por 30 s (Redis nem é consultado) → depois tenta de novo (*half-open*). Log `cache.circuito_aberto` |
| **Fallback / degradação graciosa** | Cache | Sem Redis, `getOrSet` chama o loader direto no MySQL |
| **Fallback / degradação graciosa** | Busca | Sem Meilisearch, a busca usa SQL local |
| **Fire-and-forget** | Eventos | Falha ao publicar não derruba a operação de negócio (`evento.falha_publicacao`) |
| **Isolamento de falhas (bulkhead)** | Worker | Notificações rodam em outro container: se o worker travar, a API não sente. Erros de um handler não afetam o próximo evento |
| **Health checks** | Docker Compose | `mysql` (`mysqladmin ping`), `redis` (`redis-cli ping`), `backend` (`/health`), `nginx` (HTTPS local) |
| **Auto-restart** | Docker Compose | `restart: unless-stopped` em todos os serviços de longa duração |
| **Ordem de inicialização** | Docker Compose | `depends_on: condition: service_healthy`: a API só sobe com MySQL e Redis saudáveis |
| **Transações** | Produto | Produto + cores + grades + fotos gravados atomicamente (`sequelize.transaction`) |
| **Limites de recurso** | Redis / Nginx | `maxmemory 128mb` + `allkeys-lru`; `client_max_body_size 20m` |
| **Rede interna** | Docker | MySQL/Redis/Meili na rede `data` (`internal: true`) |

## 3. Plano de observabilidade

### 3.1 Logs (o que já é coletado)

Todos os containers Node escrevem **JSON por linha** em stdout ([ADR 0007](adr/0007-logs-estruturados.md)):

```json
{"timestamp":"2026-11-02T19:03:43.512Z","level":"info","service":"agnus-api","message":"cache.hit","requestId":"90c927a7...","key":"produtos:catalogo:limit=10&page=1"}
```

| Evento (`message`) | Nível | Quando | Campos úteis |
| --- | --- | --- | --- |
| `http.request` | info / warn (4xx) / error (5xx) | Fim de toda requisição (exceto `/health`) | `method`, `path`, `status`, `durationMs`, `requestId` |
| `http.erro_nao_tratado` | error | Exceção que virou 500 | `error.stack`, `path` |
| `cache.hit` / `cache.miss` | info | Leitura com cache | `key`, `ttlSeconds` |
| `cache.invalidado` | info | Escrita em produto, cor, grade, foto ou categoria | `namespace`, `reason`, `removedKeys` |
| `cache.falha` / `cache.circuito_aberto` | warn / error | Redis com problema | `operation`, `consecutiveFailures` |
| `evento.publicado` | info | API publicou evento | `eventId`, `type`, `receivers`, `payload` |
| `evento.recebido` | info | Worker consumiu evento | `eventId`, `type`, `origemRequestId` |
| `notificacao.*` | info | Worker disparou notificação | `pedido`, `statusAnterior`, `statusNovo` |
| `redis.conectado` / `redis.erro` | info / warn | Conexão com o Redis | `role` |
| `servidor.iniciado`, `worker.iniciado` | info | Boot | `port` |

**Como consultar hoje:**

```bash
docker compose logs -f backend worker                         # tempo real
docker compose logs backend | grep '"level":"error"'          # só erros
docker compose logs backend worker | grep <requestId>         # um fluxo inteiro
```

### 3.2 Métricas

`GET /api/metrics` (JSON, por processo; **exige token de administrador**):

| Métrica | Tipo | Uso |
| --- | --- | --- |
| `http_requests_total`, `http_requests_{2,3,4,5}xx` | contador | Tráfego e taxa de erro → **SLO-1** |
| `latencyMs.p50/p95/p99` (janela das últimas 1000 req.) | percentil | **SLO-2/3** |
| `cache_hits_total`, `cache_misses_total`, `cache_errors_total`, `cache_invalidations_total` | contador | Eficiência do cache → **SLO-5** |
| `events_published_total`, `events_publish_errors_total` | contador | Saúde do Pub/Sub → **SLO-7** |
| `sli.availability`, `sli.cacheHitRatio` | razão calculada | Painel rápido |

Métricas de infraestrutura a coletar: CPU/memória por container (`docker stats`), memória e `evicted_keys` do Redis (`redis-cli INFO`), conexões do MySQL.

### 3.3 Alertas propostos

| Alerta | Condição | Severidade | Ação (runbook) |
| --- | --- | --- | --- |
| API fora | `/health` falhando por 2 min | **P1** | [Runbook §1](../operacao/runbook.md#1-site-fora-do-ar) |
| Taxa de 5xx alta | > 2% por 5 min | **P1** | [Runbook §2](../operacao/runbook.md#2-muitos-erros-500) |
| Latência alta | p95 > 500 ms por 10 min | P2 | [Runbook §3](../operacao/runbook.md#3-lentidao) |
| Circuito do cache aberto | log `cache.circuito_aberto` | P2 | [Runbook §4](../operacao/runbook.md#4-redis-fora-do-ar) |
| Worker parado | 0 `evento.recebido` em 30 min, com `evento.publicado` > 0 | P3 | [Runbook §5](../operacao/runbook.md#5-worker-nao-processa-eventos) |

### 3.4 Evolução (próximos passos)

1. Expor `/metrics` em formato **Prometheus** (`prom-client`) e montar um painel no **Grafana**.
2. Enviar os logs JSON para **Loki** (driver do Docker) e consultar por `requestId`.
3. **Tracing distribuído** com OpenTelemetry (o `requestId` já é o embrião do `traceId`).
4. ✅ `/metrics` já é restrito a administradores (`authenticateToken` + `authorizeRoles("administrador")`).
