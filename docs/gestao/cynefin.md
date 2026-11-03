# Análise do Contexto com o Framework Cynefin

## O framework

O **Cynefin** (Dave Snowden) classifica um problema pela relação entre causa e efeito e indica o modo de agir em cada domínio:

| Domínio | Causa e efeito | Como agir | Práticas |
| --- | --- | --- | --- |
| **Claro (Simples)** | Óbvia para todos | Sentir → Categorizar → Responder | Boas práticas consolidadas, checklists |
| **Complicado** | Existe, mas exige análise de especialista | Sentir → Analisar → Responder | Boas práticas, planejamento detalhado (**preditivo**) |
| **Complexo** | Só fica clara **em retrospecto** | **Sondar → Sentir → Responder** | Práticas emergentes, experimentos curtos (**ágil**) |
| **Caótico** | Não perceptível | Agir → Sentir → Responder | Contenção imediata (gestão de crise) |
| **Confuso** | Não se sabe em qual domínio se está | Decompor o problema | — |

## Classificação do Agnus

Avaliamos o projeto em várias dimensões, porque partes diferentes de um projeto podem cair em domínios diferentes:

| Dimensão | Evidência no projeto | Domínio |
| --- | --- | --- |
| **Infraestrutura técnica** (CRUD, autenticação JWT, Docker, Nginx, cache) | Padrões conhecidos e documentados; um especialista resolve com análise | Complicado |
| **Produto e mercado** (nicho católico + fitness + print on demand) | Não se sabe de antemão quais estampas, preços e funcionalidades o público valoriza. A **primeira versão (catálogo)** mostrou na prática que faltava compra integrada | **Complexo** |
| **Canais** (web vs. app mobile) | A necessidade do app mobile **surgiu durante o projeto** (versão 3), sem estar planejada | **Complexo** |
| **Pagamento online** (Mercado Pago) | Regras do gateway, conciliação e impacto na produção sob demanda ainda estão sendo descobertos (versão 4) | **Complexo** |
| **Equipe e prazos** | Equipe pequena, estudantes, prioridades acadêmicas concorrentes | Complexo |
| **Incidente em produção** (site fora) | Exige ação imediata antes de analisar | Caótico, pontual (tratado pelo [runbook](../operacao/runbook.md)) |

### Conclusão: o Agnus é um projeto **Complexo**

O fator dominante não é a dificuldade técnica, mas a **incerteza sobre o que entregar**. A própria história do produto mostra esse comportamento: **catálogo → e-commerce → mobile → pagamento**. Cada versão nasceu do aprendizado obtido com a anterior (ver *Evolução do produto* no [readme](../../readme.md)). Ninguém teria escrito essa sequência no início do projeto. Ela **emergiu**, que é a assinatura do domínio complexo: a relação causa-efeito só fica clara olhando para trás.

## Abordagem de gestão escolhida: **Ágil (Scrum + Kanban, o "Scrumban")**

| Necessidade do domínio complexo | Como o Agnus atende |
| --- | --- |
| **Sondar**: experimentos curtos e seguros | Sprints de 2 semanas com incrementos pequenos e entregáveis (cada PR é uma fatia vertical) |
| **Sentir**: feedback rápido | Review ao fim de cada sprint; CI dá feedback técnico em minutos; métricas (`/metrics`) e logs mostram o uso real |
| **Responder**: adaptar o plano | Product Backlog repriorizado a cada sprint; o épico de Pagamento entrou no meio do caminho |
| Transparência | Quadro no Jira (A Fazer → Em Andamento → Em Revisão → Concluído) |
| Qualidade sustentável | Definition of Done com testes, lint, revisão de PR e Conventional Commits |

### Por que não preditivo (cascata)?

O modelo preditivo funciona quando o escopo pode ser definido com confiança no início (domínio **complicado**). No Agnus, um plano fechado no começo **não incluiria** o app mobile nem o pagamento integrado, e teria gastado esforço em funcionalidades que o mercado não pediu.

### Por que não totalmente híbrido?

Avaliamos um modelo híbrido (fases preditivas para infraestrutura, ágil para o produto). Mesmo a infraestrutura (Docker, Nginx, Redis) foi construída de forma **incremental** e guiada por necessidades que surgiram, como o ngrok para o login mobile. Separar as duas coisas criaria burocracia sem benefício para uma equipe de duas pessoas. Mantemos, porém, **práticas de domínio complicado onde elas cabem**: ADRs, quality scenarios e runbook são análise de especialista aplicada às partes técnicas.

## Como o Scrumban é praticado

| Elemento | Prática no Agnus |
| --- | --- |
| **Papéis** | *Product Owner*: define e prioriza o backlog com a visão da loja. *Scrum Master/Dev*: remove impedimentos, cuida do processo e do CI. *Time de desenvolvimento*: os dois integrantes |
| **Sprint** | 2 semanas |
| **Planning** | Seleciona do topo do backlog as histórias que cabem na capacidade (story points) |
| **Daily** | Assíncrona (mensagem curta: o que fiz / o que farei / impedimentos) |
| **Review** | Demonstração do incremento rodando no Docker |
| **Retrospectiva** | 3 perguntas: manter / melhorar / experimentar |
| **Kanban** | WIP limit de **2 itens por pessoa** em "Em Andamento" |
| **Definition of Ready** | História no formato *Como… quero… para…*, com critérios de aceite, estimada |
| **Definition of Done** | Critérios de aceite atendidos · testes passando · lint ok · PR revisado e mergeado · docs atualizadas · rodando no `docker compose` |

Artefatos: [Product Backlog](product-backlog.md) · [Uso do Jira](jira.md) · [Versionamento](versionamento.md)
