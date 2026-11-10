# ADR 0008 — Extração para microsserviços com um banco por serviço

- **Status:** Aceito
- **Data:** 2026-11-09
- **Substitui:** [ADR 0001](0001-monolito-modular.md)

## Contexto

O monólito modular atendia bem ao volume atual. A equipe decidiu separar os contextos para demonstrar uma arquitetura preparada para crescimento: escala e deploy por contexto, falhas isoladas e dados com dono. **O volume atual, sozinho, não justificaria esse custo**; a decisão é didática e de preparação. Os módulos do monólito, um por bounded context, já indicavam onde cortar.

## Decisão

Separar em oito serviços, cada um com pacote, testes, imagem Docker e deploy próprios:

| Serviço | Dados |
| --- | --- |
| `identidade` | `agnus_identidade` (usuários, senhas, endereços, contatos) |
| `catalogo` | `agnus_catalogo` (produtos, variações, categorias, projeção de vendas) |
| `busca` | índice do Meilisearch |
| `avaliacoes` | `agnus_avaliacoes` |
| `carrinho` | `agnus_carrinho` |
| `pedidos` | `agnus_pedidos` |
| `notificacoes` | `agnus_notificacoes` e auditoria no Redis |
| `admin` (BFF) | nenhum: agrega os demais para o painel |

Regras:

1. **Banco por serviço.** Cada serviço tem um banco e um usuário MySQL que só enxerga esse banco. Os bancos ficam no mesmo servidor MySQL por custo; trocar `DB_HOST` leva um serviço para outra instância sem mudar código.
2. **Sem chave estrangeira entre serviços.** A integridade passa a ser garantida por chamadas e eventos.
3. **Síncrono só quando a resposta depende disso** (preço, endereço, "está em uso?"): HTTP em `/internal`, com token de serviço, timeout, nova tentativa em leituras e circuit breaker ([`clienteInterno.ts`](../../../services/comum/src/utils/clienteInterno.ts)).
4. **Eventos para efeitos colaterais** (Redis Pub/Sub, [ADR 0004](0004-eventos-redis-pubsub.md)).
5. **Checkout como saga com compensação.** O pedido é gravado, depois a sacola é baixada. Se a baixa não confirmar todos os itens, o pedido é desfeito.
6. **Nginx como API Gateway**: é a única entrada, e as rotas `/internal` não são publicadas.
7. **Painel administrativo separado**: outro build em `/admin`, falando com o BFF para o dashboard.
8. **Pacote `@agnus/comum`** só para infraestrutura (logs, Redis, autenticação, cliente interno). Regra de negócio não entra nele.

## Alternativas consideradas

| Alternativa | Por que foi descartada |
| --- | --- |
| Manter o monólito modular | Atende ao volume, mas não demonstra a separação pretendida |
| Serviços separados com banco compartilhado | Mantém o acoplamento pelo esquema: é um monólito distribuído |
| Uma instância de MySQL por serviço | Seis instâncias num único servidor pequeno; a separação lógica com usuários distintos dá o mesmo isolamento de acesso |
| Serviço de pagamentos agora | A integração com o Mercado Pago ainda não existe; é a próxima extração natural (US-25) |

## Consequências

- ✅ Cada serviço escala, publica e falha separadamente. Sem a busca, o catálogo segue sem a pesquisa; sem o carrinho, a vitrine continua.
- ✅ Nenhum serviço consegue ler o banco de outro, nem por engano.
- ⚠️ Mais peças para operar: dez imagens e chamadas de rede que antes eram funções.
- ⚠️ **Consistência eventual.** Sacolas e avaliações de um produto removido somem depois do evento, e o "mais vendidos" e a busca atrasam alguns segundos. Se o Pub/Sub perder um evento, as projeções se corrigem na reconciliação de 5 minutos; itens órfãos na sacola são recusados no checkout.
- ⚠️ **Janela de falha na saga.** Se a baixa da sacola expirar depois de já ter sido aplicada, o pedido é desfeito e o cliente precisa montar a sacola de novo. O caso é raro e não gera cobrança nem pedido duplicado.
- ⚠️ Exclusão de usuário com pedidos segue bloqueada; sacolas, avaliações e notificações dele são apagadas por evento.
