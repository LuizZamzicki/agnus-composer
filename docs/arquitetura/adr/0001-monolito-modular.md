# ADR 0001 — Monólito modular em vez de microsserviços

- **Status:** Substituído pelo [ADR 0008](0008-microsservicos.md)
- **Data:** 2026-06-16

## Contexto

O Agnus é desenvolvido por uma equipe pequena (2 pessoas), com entregas incrementais (catálogo → e-commerce → mobile → pagamento). O volume de acessos é de uma loja de nicho. O domínio já tem fronteiras claras (Catálogo, Carrinho, Pedidos, Identidade, Avaliações — ver [DDD](../ddd.md)), mas todas compartilham o mesmo banco e o mesmo ciclo de deploy.

## Decisão

Adotar um **monólito modular**: uma única API Node.js/Express, organizada em camadas (`controllers → services → models`) e com módulos separados por contexto de negócio. A integração assíncrona entre módulos usa **eventos** (ADR 0004), o que já prepara uma eventual extração de serviços. Processos auxiliares (worker de eventos) rodam como **containers separados a partir da mesma imagem**.

## Alternativas consideradas

| Alternativa | Por que foi descartada |
| --- | --- |
| Microsserviços (um por contexto) | Custo operacional alto (vários deploys, observabilidade distribuída, consistência eventual em tudo) sem ganho real para o volume atual |
| Monólito sem fronteiras (*big ball of mud*) | Dificulta testes, evolução e a futura extração de partes como pagamento |
| Modulith com bancos separados por módulo | Exigiria refatorar as consultas de catálogo/mais vendidos, que juntam várias tabelas |

## Consequências

- ✅ Um único build, um único deploy e debugging simples.
- ✅ Transações ACID entre produto, cores, grades e fotos (`sequelize.transaction`).
- ✅ Eventos já desacoplam efeitos colaterais (notificações, auditoria).
- ⚠️ Escala vertical ou por réplicas idênticas. Não é possível escalar só o catálogo.
- ⚠️ Disciplina de fronteiras depende de revisão de código (PR template + CI).
