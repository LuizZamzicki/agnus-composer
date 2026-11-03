# Gestão do Trabalho no Jira

## Estrutura do projeto

| Item | Configuração |
| --- | --- |
| **Projeto** | `AGNUS` (template *Scrum*, quadro com colunas Kanban) |
| **Tipos de issue** | **Epic** (EP-xx) → **Story** (US-xx, valor para o usuário) · **Task** (TS-xx, enabler técnico) · **Bug** · **Sub-task** (passos de uma história) |
| **Fluxo (colunas)** | `A Fazer` → `Em Andamento` (WIP ≤ 2 por pessoa) → `Em Revisão` (PR aberto) → `Concluído` |
| **Campos usados** | Responsável, Prioridade (MoSCoW → Highest/High/Medium/Lowest), Story Points, Sprint, **Fix Version** (release SemVer), Labels (`tecnico`, `bug`, `incidente`) |
| **Sprints** | 2 semanas, nomeadas `AGNUS Sprint N` |
| **Releases** | Versões do Jira = tags do Git (`3.3.0`, `4.0.0`), ver [versionamento](versionamento.md) |

## Importar o backlog

O arquivo [`jira-import.csv`](jira-import.csv) traz **8 épicos, 29 histórias, 10 tasks e 8 bugs** (4 deles de segurança), com hierarquia, prioridade, pontos, status e versão.

1. Jira → **Configurações do projeto** → **Versões**: criar `2.0.0`, `2.1.0`, `2.2.0`, `3.0.0`, `3.1.0`, `3.2.0`, `3.2.1`, `3.3.0` (lançadas) e `4.0.0` (não lançada).
2. **Filtros / Issues** → menu `⋯` → **Importar issues de CSV** → selecionar `docs/gestao/jira-import.csv` (codificação UTF-8).
3. Mapear as colunas:

   | Coluna do CSV | Campo do Jira |
   | --- | --- |
   | Issue Id | Issue Id |
   | Parent Id | Parent Id (cria o vínculo Épico → Story/Task/Bug) |
   | Issue Type | Issue Type |
   | Summary / Description | Summary / Description |
   | Priority | Priority |
   | Story Points | Story point estimate |
   | Status | Status (mapear `To Do`, `In Progress`, `Done`, `Won't Do` para as colunas do quadro) |
   | Fix Version | Fix versions |
   | Labels | Labels |

4. Depois de importar: **atribuir os responsáveis** (Luiz / Bruno), criar a sprint atual com US-25, US-22 e US-23 e iniciá-la.

## Ligação entre Jira e GitHub

Para a rastreabilidade ficar visível nas issues, instale o app **GitHub for Jira** e cite a chave da issue:

| Onde | Padrão | Exemplo |
| --- | --- | --- |
| Branch | `<tipo>/AGNUS-<n>-descricao` | `feat/AGNUS-206-cache-redis` |
| Commit (Conventional Commits) | `<tipo>: AGNUS-<n> descrição` | `feat: AGNUS-206 cache-aside no catálogo` |
| Pull Request | título com a chave | `AGNUS-206 Cache Redis e eventos` |

Com isso, cada issue mostra os branches, commits, PRs e o status do CI.

## Rotina da equipe

| Momento | O que é feito no Jira |
| --- | --- |
| **Planning** | Mover histórias do backlog para a sprint, estimar e definir a meta da sprint |
| **Durante a sprint** | Cada pessoa move o próprio card; impedimentos viram comentário com `@menção` |
| **PR aberto** | Card vai para `Em Revisão`; o link do PR aparece na issue |
| **Merge** | Card vai para `Concluído`, se a Definition of Done foi atendida |
| **Bug encontrado** | Nova issue **Bug** com passos para reproduzir, ligada à história de origem |
| **Review** | Filtrar `sprint = "AGNUS Sprint N" AND status = Done` e demonstrar |
| **Release** | Jira → Versões → **Lançar** `X.Y.Z` (gera as notas de versão) |

## Evidências para a avaliação

Capturas de tela a anexar na entrega:

- [ ] Quadro da sprint com cards em todas as colunas
- [ ] Backlog com épicos e histórias priorizadas
- [ ] Uma história aberta mostrando critérios de aceite, pontos, responsável e PR vinculado
- [ ] Bugs com responsável e status
- [ ] Página de versões (releases) com `3.3.0` lançada
- [ ] Relatório de sprint (burndown ou velocity)
