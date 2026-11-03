# ADR 0005 — Meilisearch para busca textual, com fallback SQL

- **Status:** Aceito
- **Data:** 2026-06-25

## Contexto

Clientes buscam por termos imprecisos ("camisa", "regata", "dry fit", "terço") e com erros de digitação. `LIKE '%termo%'` no MySQL não trata relevância, sinônimos nem tolerância a erros, e piora com o volume.

## Decisão

Indexar produtos no **Meilisearch** (índice `produtos`, sinônimos configurados em `produtoSearchIndex.service.ts`), sincronizando no boot e a cada escrita de produto. Se o Meilisearch não estiver configurado ou falhar, a busca **cai para SQL local** (log `Meilisearch indisponivel. Busca local sera usada.`).

## Consequências

- ✅ Busca tolerante a erros e com sinônimos.
- ✅ Degradação graciosa: o catálogo nunca fica indisponível por causa da busca.
- ⚠️ Índice eventualmente consistente; a sincronização completa no boot corrige divergências.
