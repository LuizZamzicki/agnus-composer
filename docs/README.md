# Documentação do Agnus

Índice organizado pelos itens da rubrica de avaliação. Cada linha aponta o artefato e, quando há código, onde ele está.

> **Como validar cada item:** roteiro passo a passo em [validacao-rubrica.md](validacao-rubrica.md).

## Arquitetura de Software

| Item da rubrica | Entregáveis |
| --- | --- |
| **Documentação Arquitetural** | [Mapa dos microsserviços](arquitetura/microsservicos.md) · [C4: Contexto e Containers](arquitetura/c4-contexto-containers.md) · [ADRs](arquitetura/adr/README.md) (incl. [monólito modular vs. microsserviços](arquitetura/adr/0001-monolito-modular.md)) · [Quality Scenarios](arquitetura/quality-scenarios.md) |
| **Estilos Arquiteturais e DDD** | [Context Map, subdomínios, Bounded Contexts, Entities/VOs/Aggregates](arquitetura/ddd.md) |
| **Integração, APIs e Dados** | [OpenAPI](../services/catalogo/openapi.yaml) (Swagger UI em `/api/docs/`) · [Visão de integrações](arquitetura/integracao-apis-dados.md) · [ADR do banco de dados](arquitetura/adr/0002-banco-de-dados-mysql.md) |
| **Qualidade, Resiliência e Observabilidade** | [SLOs/SLIs, estratégias de resiliência e plano de observabilidade](arquitetura/slo-sli-resiliencia-observabilidade.md) |
| **Entrega Contínua** | Pipelines [`ci.yml`](../.github/workflows/ci.yml) e [`cd.yml`](../.github/workflows/cd.yml) · [Estratégia de deploy](arquitetura/entrega-continua.md) · [Runbook de incidentes](operacao/runbook.md) |

## Back-end Avançado

| Item da rubrica | Onde está |
| --- | --- |
| **Cache distribuído com Redis** (cache-aside, TTL, invalidação) | [`cache.service.ts`](../services/catalogo/src/services/cache.service.ts), [`config/cache.ts`](../services/catalogo/src/config/cache.ts), usado em [`produtoCatalog.service.ts`](../services/catalogo/src/services/produtoCatalog.service.ts) e [`categorias.controller.ts`](../services/catalogo/src/controllers/categorias.controller.ts) · [Roteiro de demonstração](backend/redis-cache-e-eventos.md) |
| **Mensageria (Redis Pub/Sub) e logs de circulação** | [`eventBus.service.ts`](../services/comum/src/services/eventBus.service.ts) (publica) · [`worker.ts`](../services/notificacoes/src/worker.ts) (consome) · serviço `worker` no [`docker-compose.yml`](../docker-compose.yml) · [logs reais](backend/redis-cache-e-eventos.md#saída-real-execução-de-2026-11-02) |
| **Docker Compose + Nginx como proxy reverso** | [`docker-compose.yml`](../docker-compose.yml) (8 microsserviços + infraestrutura, healthchecks, redes `app`/`data` isoladas) · [`nginx.conf`](../gateway/nginx.conf) (TLS, `/api` → upstream com keepalive, timeouts, gzip, *rate limit* no login, cabeçalhos de segurança, `X-Request-Id`; a API só aceita conexão direta de `127.0.0.1`) · [ADR 0006](arquitetura/adr/0006-nginx-proxy-reverso.md) |
| **Boas práticas e observabilidade** | [Rotas por bounded context](../services) · camadas `controllers/services/models/middlewares`, DTOs em `src/types`, [regras do agregado Pedido](../services/pedidos/src/services/pedidoRegras.service.ts) · [logger JSON](../services/comum/src/utils/logger.ts) · [request logger](../services/comum/src/middlewares/requestLogger.middleware.ts) · [tratamento de erros](../services/comum/src/middlewares/error.middleware.ts) · [métricas](../services/comum/src/utils/metrics.ts) · 521 testes automatizados no back-end e 39 no front |

## Tech Forge (Gestão)

| Item da rubrica | Entregáveis |
| --- | --- |
| **Gestão do trabalho via Jira** | [Como o Jira é usado + passo a passo de importação](gestao/jira.md) · [`jira-import.csv`](gestao/jira-import.csv) (épicos, histórias, tasks, bugs) |
| **Análise Cynefin e escolha da abordagem** | [Cynefin → Complexo → Ágil (Scrumban)](gestao/cynefin.md) |
| **Ciclo de vida (Ágil)** | [Product Backlog com User Stories e critérios de aceite](gestao/product-backlog.md) · [Versionamento SemVer e releases](gestao/versionamento.md) · [CHANGELOG](../CHANGELOG.md) |

## Como rodar e verificar

```bash
docker compose up -d --build
open https://localhost                 # loja
open https://localhost/api/docs/       # Swagger
curl -sk -H "Authorization: Bearer $TOKEN_ADMIN" https://localhost/api/metrics  # métricas (admin)
docker compose logs -f pedidos notificacoes  # logs JSON (cache e eventos)
```
