# Architecture Decision Records (ADRs)

Cada ADR registra **uma** decisão arquitetural relevante: o contexto, a decisão, as alternativas descartadas e as consequências. ADRs não são editados depois de aceitos. Se a decisão mudar, cria-se um novo ADR que **substitui** o anterior.

| # | Decisão | Status |
| --- | --- | --- |
| [0001](0001-monolito-modular.md) | Monólito modular em vez de microsserviços | Substituído pelo 0008 |
| [0002](0002-banco-de-dados-mysql.md) | MySQL como banco de dados principal | Aceito |
| [0003](0003-cache-redis-cache-aside.md) | Cache distribuído com Redis no padrão cache-aside | Aceito |
| [0004](0004-eventos-redis-pubsub.md) | Eventos de domínio via Redis Pub/Sub + worker | Aceito |
| [0005](0005-busca-meilisearch.md) | Meilisearch para busca textual, com fallback SQL | Aceito |
| [0006](0006-nginx-proxy-reverso.md) | Nginx como proxy reverso único com TLS | Aceito |
| [0007](0007-logs-estruturados.md) | Logs estruturados em JSON com correlação por requestId | Aceito |
| [0008](0008-microsservicos.md) | Extração para microsserviços com um banco por serviço | Aceito |

Modelo usado: *Michael Nygard* (Contexto → Decisão → Alternativas → Consequências).
