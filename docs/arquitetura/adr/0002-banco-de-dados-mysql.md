# ADR 0002 — MySQL como banco de dados principal

- **Status:** Aceito
- **Data:** 2026-06-16

## Contexto

Os dados do Agnus são fortemente relacionais: usuário → endereços/contatos, produto → categoria/cores/grades/fotos, carrinho → itens, pedido → itens → cor/grade do produto, avaliação → fotos. Operações de compra precisam de **consistência transacional** (pedido, itens e estoque devem ser gravados juntos). Relatórios como "mais vendidos" dependem de `JOIN` + `SUM` + `GROUP BY`.

## Decisão

Usar **MySQL 8.4 (LTS)** como fonte da verdade, acessado pelo ORM **Sequelize** com o driver `mysql2`, executando em container com volume nomeado (`mysql_data`) e healthcheck (`mysqladmin ping`). O banco fica numa rede Docker **interna** (`data`), inacessível de fora.

## Alternativas consideradas

| Alternativa | Por que foi descartada |
| --- | --- |
| PostgreSQL | Tecnicamente equivalente ou superior. Descartado pela familiaridade da equipe com MySQL e pela hospedagem-alvo (planos compartilhados oferecem MySQL com mais frequência). O código continua portável via Sequelize (dependência `pg` já presente) |
| MongoDB | Modelo de documentos não ajuda nas consultas relacionais (mais vendidos, pedidos por usuário) e enfraquece a integridade referencial |
| SQLite | Sem concorrência adequada para múltiplas réplicas da API |

## Consequências

- ✅ Integridade referencial (FKs) e transações ACID.
- ✅ Versão LTS com suporte longo e JSON nativo (usado nas consultas de catálogo com `JSON_QUOTE`/`GROUP_CONCAT`).
- ⚠️ Consultas pesadas de catálogo motivaram o cache (ADR 0003) e o motor de busca (ADR 0005).
- ⚠️ Hoje o schema é sincronizado por `sequelize.sync({ alter: true })`. Para produção, recomenda-se migrar para **migrations** versionadas (`sequelize-cli` já está instalado).
