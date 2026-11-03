# Diagramas C4 — Contexto e Containers

Os diagramas estão em [Mermaid](https://mermaid.js.org/) e são renderizados automaticamente pelo GitHub.

## Nível 1 — Contexto do sistema

Quem usa o Agnus e com quais sistemas externos ele conversa.

```mermaid
C4Context
    title Agnus — Diagrama de Contexto

    Person(cliente, "Cliente", "Navega no catálogo, monta o carrinho, faz pedidos e avalia produtos (web ou app mobile)")
    Person(admin, "Administrador / Equipe", "Gerencia produtos, categorias, pedidos e usuários (cargo administrador; vendas, atendimento e auditor previstos no RF07)")

    System(agnus, "Agnus E-commerce", "Loja virtual de roupas esportivas com estampas católicas no modelo print on demand")

    System_Ext(google, "Google OAuth 2.0", "Login social")
    System_Ext(mp, "Mercado Pago", "Processamento de pagamentos (versão 4, em integração)")
    System_Ext(ngrok, "ngrok", "Túnel HTTPS público para o backend (callback OAuth / app mobile)")

    Rel(cliente, agnus, "Compra produtos", "HTTPS")
    Rel(admin, agnus, "Administra a loja", "HTTPS")
    Rel(agnus, google, "Troca code por token e lê o perfil", "HTTPS")
    Rel(agnus, mp, "Cria e consulta pagamentos", "HTTPS")
    Rel(ngrok, agnus, "Encaminha chamadas externas", "HTTPS")
```

## Nível 2 — Containers

Cada caixa é um container do `docker-compose.yml`. A rede `data` é **interna** (sem saída para a internet). Só o Nginx, o backend (porta 3000, para desenvolvimento) e o ngrok expõem portas.

```mermaid
C4Container
    title Agnus — Diagrama de Containers

    Person(cliente, "Cliente / Admin")

    System_Boundary(agnus, "Agnus (docker compose)") {
        Container(nginx, "Nginx", "nginx:alpine", "Proxy reverso + TLS. Serve o SPA e encaminha /api para o backend, com cabeçalhos de segurança e X-Request-Id")
        Container(spa, "Frontend SPA", "React (build estático)", "Interface do cliente e painel administrativo")
        Container(api, "API Backend", "Node.js 22 + Express 5 + TypeScript", "Regras de negócio, autenticação JWT, RBAC, cache-aside e publicação de eventos")
        Container(worker, "Worker de eventos", "Node.js (mesma imagem da API)", "Assina eventos no Redis Pub/Sub, registra auditoria e dispara notificações")
        ContainerDb(mysql, "MySQL 8.4", "Banco relacional", "Fonte da verdade: usuários, produtos, carrinhos, pedidos, avaliações")
        ContainerDb(redis, "Redis 7.4", "Cache em memória + Pub/Sub", "Cache de leituras (TTL) e barramento de eventos")
        ContainerDb(meili, "Meilisearch 1.13", "Motor de busca", "Busca textual tolerante a erros e sinônimos no catálogo")
    }

    System_Ext(google, "Google OAuth")
    System_Ext(ngrok, "ngrok")

    Rel(cliente, nginx, "Acessa", "HTTPS 443")
    Rel(nginx, spa, "Serve arquivos estáticos")
    Rel(nginx, api, "Proxy /api/*", "HTTP 3000")
    Rel(ngrok, api, "Túnel", "HTTP 3000")
    Rel(api, mysql, "Lê/escreve", "Sequelize / TCP 3306")
    Rel(api, redis, "GET/SET/SCAN/DEL + PUBLISH", "RESP 6379")
    Rel(api, meili, "Indexa e busca produtos", "HTTP 7700")
    Rel(worker, redis, "PSUBSCRIBE agnus.eventos.* + LPUSH auditoria", "RESP 6379")
    Rel(api, google, "OAuth 2.0", "HTTPS")
```

## Nível 3 — Componentes da API (resumo)

```mermaid
flowchart LR
    subgraph API["API Backend (Express)"]
        MW["Middlewares<br/>requestLogger · auth JWT · RBAC · upload · errorHandler"]
        C["Controllers<br/>usuarios · produtos · categorias · carrinho · pedidos · auth"]
        S["Services<br/>produtoCatalog · produtoMutation · auth · searchIndex"]
        INF["Infra<br/>cache.service · eventBus.service · logger · metrics"]
        M["Models (Sequelize)"]
    end
    MW --> C --> S --> M
    S --> INF
    C --> INF
    M --> DB[(MySQL)]
    INF --> R[(Redis)]
    S --> MS[(Meilisearch)]
```

| Camada | Pasta | Responsabilidade |
| --- | --- | --- |
| Middlewares | `agnus-back/src/middlewares` | Correlação de logs (`X-Request-Id`), autenticação, autorização por permissão, upload Multer, tratamento centralizado de erros |
| Controllers | `agnus-back/src/controllers` | Validação de entrada e montagem da resposta HTTP |
| Services | `agnus-back/src/services` | Regras de negócio, transações, cache e eventos |
| Types/DTOs | `agnus-back/src/types` | Contratos de entrada/saída (`*Body`, `*Query`, `*RouteParams`) e eventos |
| Models | `agnus-back/src/models` | Mapeamento objeto-relacional |
| Config | `agnus-back/src/config` | Banco, Redis, TTLs de cache, matriz de permissões |
