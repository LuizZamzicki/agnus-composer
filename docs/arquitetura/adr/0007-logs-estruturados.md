# ADR 0007 — Logs estruturados em JSON com correlação por requestId

- **Status:** Aceito
- **Data:** 2026-11-02

## Contexto

Os logs eram `console.log` em texto livre, e erros 500 eram respondidos sem nenhum registro. Com API e worker separados, é preciso seguir um fluxo (requisição → cache → evento → worker) entre containers.

## Decisão

- Logger próprio (`src/utils/logger.ts`, sem dependências) que escreve **uma linha JSON por evento**: `timestamp`, `level`, `service`, `message`, `requestId` + contexto.
- O middleware `requestLogger` gera ou propaga o `X-Request-Id` (o Nginx envia `$request_id`), devolve o id no cabeçalho de resposta e o guarda em `AsyncLocalStorage`. Assim, qualquer log da requisição o inclui sem passar parâmetros.
- Eventos carregam o `requestId`, e o worker o registra como `origemRequestId`.
- Nível configurável por `LOG_LEVEL` (`debug|info|warn|error|silent`; silencioso em testes).
- `errorHandler` registra `http.erro_nao_tratado` com stack antes de responder 500.
- Métricas em memória expostas em `GET /metrics` (contadores, latência p50/p95/p99, disponibilidade, taxa de acerto do cache).

## Consequências

- ✅ `docker compose logs backend worker | grep <requestId>` reconstrói um fluxo inteiro.
- ✅ Formato pronto para Loki, Elastic ou CloudWatch, sem mudar o código.
- ⚠️ Métricas em memória são por processo e zeram no restart. Para produção, exportar em formato Prometheus.
