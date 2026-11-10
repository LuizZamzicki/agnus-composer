# Gestão do Trabalho no Jira

## Estrutura do projeto

| Item | Configuração |
| --- | --- |
| **Projeto** | `AGNUS` (template *Scrum*, quadro com colunas Kanban) |
| **Tipos de issue** | **Epic** (EP-xx) → **Story** (US-xx, valor para o usuário) · **Task** (TS-xx, enabler técnico) · **Bug** · **Sub-task** (passos de uma história) |
| **Fluxo (colunas)** | `A Fazer` → `Em Andamento` (WIP ≤ 2 por pessoa) → `Em Revisão` (PR aberto) → `Concluído` |
| **Campos usados** | Responsável, Prioridade (MoSCoW → Highest/High/Medium/Lowest), Story Points, Sprint, **Fix Version** (release SemVer), Labels (`tecnico`, `bug`, `seguranca`, `incidente`) |
| **Sprints** | 2 semanas, nomeadas `AGNUS Sprint N` |
| **Releases** | Versões do Jira = tags do Git (`3.3.0`, `4.0.0`), ver [versionamento](versionamento.md) |

## Importar o backlog

O arquivo [`jira-import.csv`](jira-import.csv) traz **8 épicos, 33 histórias, 17 tasks e 21 bugs** (12 deles de segurança), com hierarquia, prioridade, pontos, status, versão, **responsável** e a **sprint atual**.

### Antes de importar (5 min)

1. Convide o Bruno para o projeto (**Configurações do projeto → Pessoas**), para que o responsável possa ser mapeado.
2. **Configurações do projeto → Versões** (ou **Releases**): crie `2.0.0`, `2.1.0`, `2.2.0`, `3.0.0`, `3.1.0`, `3.2.0`, `3.2.1`, `3.3.0`, `3.4.0` e `4.0.0`.
3. **Backlog → Criar sprint** com o nome exato `AGNUS Sprint 1` (não inicie ainda).

### Importação

1. **Filtros / Issues** → menu `⋯` → **Importar issues de CSV** → `docs/gestao/jira-import.csv` (codificação **UTF-8**, separador **vírgula**).
2. Mapeie as colunas:

   | Coluna do CSV | Campo do Jira | Observação |
   | --- | --- | --- |
   | Issue Id | Issue Id | Usado só para montar a hierarquia |
   | Parent Id | Parent Id | Liga Story/Task/Bug ao Épico |
   | Issue Type | Issue Type | |
   | Epic Name | Epic Name | Só existe em projetos *company-managed*; nos *team-managed*, ignore |
   | Summary / Description | Summary / Description | |
   | Priority | Priority | |
   | Labels (2 colunas) | Labels | O Jira junta as duas colunas |
   | Story Points | Story point estimate | |
   | Status | Status | `To Do`, `In Progress`, `Done`, `Won't Do` → colunas do quadro |
   | Fix Version | Fix versions | |
   | Assignee | Assignee | Na etapa **Mapear valores**, ligue `Luiz Zamzicki` e `Bruno Medeiros` às contas de vocês |
   | Sprint | Sprint | Liga 6 itens à `AGNUS Sprint 1` |

3. Confira: o backlog deve mostrar 79 issues, e a sprint, US-25, US-26, US-24, TS-09, TS-16 e TS-17.

### Depois de importar (é o que a rubrica avalia: uso real)

1. **Inicie a `AGNUS Sprint 1`** (2 semanas) com a meta *"Pagamento online e loja publicada"*.
2. **Lance as versões já entregues** (Releases → `⋯` → *Lançar*): `2.0.0` a `3.4.0`, cada uma com a data do [CHANGELOG](../../CHANGELOG.md).
3. Durante a sprint, **cada um move os próprios cards** (`A Fazer → Em Andamento → Em Revisão → Concluído`) à medida que trabalha, comentando impedimentos com `@menção`.
4. Use a chave da issue nas branches, commits e PRs (seção abaixo), para que o Jira mostre o desenvolvimento ligado a cada card.
5. Tire as capturas da lista de evidências no fim deste documento.

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

Capturas de tela a salvar em `docs/gestao/evidencias/` e anexar na entrega:

- [ ] Quadro da sprint com cards em todas as colunas
- [ ] Backlog com épicos e histórias priorizadas
- [ ] Uma história aberta mostrando critérios de aceite, pontos, responsável e PR vinculado
- [ ] Bugs com responsável e status
- [ ] Página de versões (releases) com `3.4.0` lançada
- [ ] Painel *Desenvolvimento* de uma issue mostrando branch/commit/PR do GitHub
- [ ] Relatório de sprint (burndown ou velocity)
