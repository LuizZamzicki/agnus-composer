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

Cada caixa é um container do `docker-compose.yml`. A rede `data` é **interna** (sem saída para a internet). De fora, só o gateway (80/443) é acessível. Contratos completos em [microsservicos.md](microsservicos.md).

```mermaid
C4Container
    title Agnus — Diagrama de Containers

    Person(cliente, "Cliente / Admin")

    System_Boundary(agnus, "Agnus (docker compose)") {
        Container(nginx, "Gateway Nginx", "nginx:alpine", "TLS, cabeçalhos de segurança, rate limit e roteamento por serviço")
        Container(spa, "Loja", "React", "Interface do cliente")
        Container(painel, "Painel admin", "React", "Publicado em /admin")
        Container(id, "identidade", "Node.js", "Login, JWT, usuários, endereços")
        Container(cat, "catalogo", "Node.js", "Produtos, categorias, cache-aside, vendas")
        Container(bus, "busca", "Node.js", "Indexa e pesquisa produtos")
        Container(av, "avaliacoes", "Node.js", "Avaliações e fotos")
        Container(car, "carrinho", "Node.js", "Sacola")
        Container(ped, "pedidos", "Node.js", "Pedidos e saga do checkout")
        Container(not, "notificacoes", "Node.js", "Sino do site, auditoria, consumidor de eventos")
        Container(adm, "admin", "Node.js", "BFF do painel e métricas consolidadas")
        ContainerDb(mysql, "MySQL 8.4", "Um banco e um usuário por serviço", "agnus_identidade, agnus_catalogo, agnus_avaliacoes, agnus_carrinho, agnus_pedidos, agnus_notificacoes")
        ContainerDb(redis, "Redis 7.4", "Cache + Pub/Sub", "Cache de leituras e barramento de eventos")
        ContainerDb(meili, "Meilisearch 1.13", "Motor de busca", "Índice do catálogo")
    }

    System_Ext(google, "Google OAuth")
    System_Ext(ngrok, "ngrok")

    Rel(cliente, nginx, "Acessa", "HTTPS 443")
    Rel(ngrok, nginx, "Túnel", "HTTP 8080")
    Rel(nginx, spa, "Serve")
    Rel(nginx, painel, "Serve /admin")
    Rel(nginx, cat, "/api/products…", "HTTP")
    Rel(nginx, ped, "/api/orders…", "HTTP")
    Rel(ped, car, "Baixa a sacola", "HTTP /internal")
    Rel(ped, cat, "Consulta preços", "HTTP /internal")
    Rel(cat, redis, "Cache e eventos", "RESP")
    Rel(not, redis, "PSUBSCRIBE", "RESP")
    Rel(bus, meili, "Indexa e busca", "HTTP")
    Rel(id, google, "OAuth 2.0", "HTTPS")
    Rel(ped, mysql, "agnus_pedidos", "TCP")
```

## Nível 3 — Componentes de um serviço (resumo)

```mermaid
flowchart LR
    subgraph API["Serviço (Express), mesma estrutura em todos"]
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
| Middlewares | `services/comum/src/middlewares` | Correlação de logs (`X-Request-Id`), autenticação, autorização por permissão, upload Multer, tratamento centralizado de erros |
| Controllers | `services/<serviço>/src/controllers` | Validação de entrada e montagem da resposta HTTP |
| Services | `services/<serviço>/src/services` | Regras de negócio, transações, cache e eventos |
| Types/DTOs | `services/<serviço>/src/types` | Contratos de entrada/saída (`*Body`, `*Query`, `*RouteParams`) e eventos |
| Models | `services/<serviço>/src/models` | Mapeamento objeto-relacional |
| Config | `services/comum/src/config` | Banco, Redis, TTLs de cache, matriz de permissões |
