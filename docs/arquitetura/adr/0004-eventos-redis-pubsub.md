# ADR 0004 — Eventos de domínio via Redis Pub/Sub + worker

- **Status:** Aceito
- **Data:** 2026-11-02

## Contexto

Algumas ações de negócio disparam efeitos colaterais que **não devem atrasar nem derrubar** a requisição do usuário: avisar a equipe de vendas sobre um novo pedido (modelo print on demand), notificar o cliente quando o status muda, manter uma trilha de auditoria. Colocar essa lógica nos controllers acoplaria os contextos.

## Decisão

- Publicar **eventos de domínio** no Redis Pub/Sub pelo `EventBusService.publish`, um canal por tipo: `agnus.eventos.<tipo>`.
- Eventos atuais: `produto.criado|atualizado|removido`, `categoria.criada|atualizada|removida`, `pedido.criado|atualizado|removido`.
- Envelope padrão: `{ id, type, occurredAt, source, requestId, payload }`. O `requestId` liga o evento à requisição HTTP que o originou.
- Um **worker** (`src/worker.ts`, container `agnus-notificacoes`, mesma imagem da API) assina `agnus.eventos.*` com `PSUBSCRIBE`, grava cada evento na lista `agnus:auditoria:eventos` (últimos 500) e executa os handlers (notificações).
- Publicação é *best effort*: falha no Redis gera log `evento.falha_publicacao`, mas não falha a operação.

## Alternativas consideradas

| Alternativa | Por que foi descartada |
| --- | --- |
| RabbitMQ / Kafka | Garantias maiores, mas mais um serviço para operar; o Redis já existe pelo cache |
| Redis Streams | Dá persistência e consumer groups. É o **próximo passo** se perder eventos passar a ser inaceitável |
| Chamada síncrona direta | Acopla contextos e aumenta a latência da requisição |

## Consequências

- ✅ Contextos desacoplados; novos consumidores entram sem mudar quem publica.
- ✅ Logs de `evento.publicado` (API) e `evento.recebido` (worker) com o mesmo `requestId` comprovam a circulação.
- ⚠️ Pub/Sub é **at-most-once**: se o worker estiver fora no momento da publicação, o evento é perdido. Aceitável para notificações e auditoria; **não** usar para fluxos financeiros (ex.: confirmação de pagamento), que devem ir para Streams ou fila durável.
