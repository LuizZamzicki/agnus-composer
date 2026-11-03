# ADR 0003 — Cache distribuído com Redis no padrão cache-aside

- **Status:** Aceito
- **Data:** 2026-11-02

## Contexto

As rotas mais acessadas são leituras públicas do catálogo (`/products`, `/products/catalog`, `/products/best-sellers`, `/products/:id`, `/categories`). A consulta de catálogo agrega fotos e categoria, e a de mais vendidos agrega pedidos. O dado muda pouco: só por ação administrativa ou por novas vendas. Um cache em memória local não serve se a API rodar com mais de uma réplica.

## Decisão

1. Usar **Redis 7.4** como cache distribuído (container `redis`, rede interna, `maxmemory 128mb` + `allkeys-lru`, sem persistência).
2. Padrão **cache-aside** em `CacheService.getOrSet`: lê do Redis; em *miss*, carrega do MySQL e grava com **TTL**.
3. **Chaves determinísticas** `agnus:cache:<namespace>:<operação>:<parâmetros ordenados>` (ex.: `agnus:cache:produtos:catalogo:limit=10&page=1`).
4. **TTL por tipo de dado** (`src/config/cache.ts`): mais vendidos 60s, listas/catálogo 120s, detalhe de produto 300s, categorias 600s.
5. **Invalidação ativa nas escritas**: criar/editar/remover produto, foto ou categoria chama `invalidateNamespace`, que remove as chaves do namespace via `SCAN` + `DEL` (sem `KEYS`, que bloqueia o Redis).
6. Respostas de erro (`{ message }`) **não** são cacheadas.
7. **Resiliência**: `commandTimeout` de 500ms, sem fila offline, *circuit breaker* (5 falhas → 30s sem consultar o Redis). Se o Redis cair, a API segue respondendo direto do banco.

## Alternativas consideradas

| Alternativa | Por que foi descartada |
| --- | --- |
| Cache em memória do processo (Map/LRU) | Inconsistente entre réplicas; a invalidação não se propaga |
| Write-through | Exigiria saber antecipadamente todas as combinações de filtro/página a atualizar |
| Somente TTL, sem invalidação | Admin veria dados antigos por até 10 minutos depois de editar |
| Cache HTTP no Nginx | Não dá para invalidar seletivamente a partir das regras de negócio |

## Consequências

- ✅ Menos carga no MySQL e menor latência nas páginas públicas (hit ≈ 1 ida ao Redis).
- ✅ Edição administrativa reflete imediatamente (invalidação síncrona antes da resposta).
- ⚠️ **Mais vendidos** depende de pedidos, que não invalidam o cache: aceita-se até 60s de defasagem (TTL curto).
- ⚠️ A invalidação é por namespace inteiro (simples e segura). Com muitos produtos, pode-se evoluir para invalidação por chave ou por versão de namespace.
