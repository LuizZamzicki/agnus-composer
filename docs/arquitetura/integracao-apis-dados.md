# Integração, APIs e Dados

## Contrato da API (OpenAPI)

- **Arquivo:** [`agnus-back/openapi.yaml`](../../agnus-back/openapi.yaml) (OpenAPI 3.0.3)
- **Swagger UI interativo:** `https://localhost/api/docs/` (com `docker compose up`), ou `http://localhost:3000/docs/` direto no backend
- **JSON da especificação:** `https://localhost/api/openapi.json`
- **Coleção Postman:** gerada a partir das rotas com `npm run postman:generate` (pasta `agnus-back/postman`)

Endpoints documentados, agrupados por recurso:

| Grupo | Endpoints principais |
| --- | --- |
| Observabilidade | `GET /health`, `GET /metrics` |
| Autenticação | `POST /auth/login`, `GET /auth/me`, `GET /auth/google`, `GET /auth/google/callback` |
| Usuários | `POST/GET /users`, `GET/PUT/DELETE /users/{id}`, `PATCH /users/{id}/password` |
| Endereços | `POST /user-addresses`, `GET /user-addresses/{id_user}` |
| Categorias | `GET/POST /categories`, `GET/PUT/DELETE /categories/{id}` |
| Produtos | `GET/POST /products`, `GET /products/catalog`, `GET /products/best-sellers`, `GET/PUT/DELETE /products/{id}` |
| Fotos | `POST /product-photos` (multipart), `GET /product-photos/{id_produto}` |
| Carrinho | `POST /carts`, `POST /cart-items`, `GET /cart-items/{id_cart}` |
| Contatos | `POST /user-contacts`, `GET /user-contacts/{id_user}` |
| Variações | `POST /product-colors`, `GET /product-colors/{id_produto}`, `POST /product-grades`, `GET /product-grades/{id_produto}` |
| Avaliações | `POST /product-reviews`, `GET /product-reviews/{id_produto}` |
| Pedidos | `POST /orders/checkout` (compra do cliente), `GET /orders/me`, `GET/POST /orders` (equipe), `GET/PUT/DELETE /orders/{id}` (PUT valida a transição de status → 409) |
| Itens de pedido | `POST /order-items`, `GET /order-items/{id_order}`, `PUT/DELETE /order-items/{id}` (só com o pedido em aberto → 409; recalculam o total) |

### Convenções

| Tema | Convenção |
| --- | --- |
| Autenticação | `Authorization: Bearer <JWT>`; permissões por cargo em `config/permissions.ts` |
| Dados pessoais | Endereços, contatos, carrinhos, avaliações e itens de pedido exigem token e só aceitam o **dono** do registro (ou admin), via `ownership.middleware.ts`. Leituras públicas: catálogo, categorias e avaliações de um produto |
| Upload | `multipart/form-data` (ou base64), até 20 MB. JPEG, PNG, GIF, WebP e BMP, com o formato decidido pelos **magic bytes** do conteúdo (`utils/imageSignature.ts`); MIME e extensão enviados pelo cliente são ignorados |
| Paginação | `?page=1&limit=10` → `{ data: [...], pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage } }` |
| Erros | `{ "message": "..." }` com 400 (validação), 401, 403, 404, 409 (conflito ou transição de status inválida), 429 (excesso de tentativas de login, aplicado pelo Nginx), 500 (sem detalhes internos) |
| Rastreabilidade | Toda resposta inclui `X-Request-Id` |
| Prefixo | Atrás do Nginx a API fica em `/api` (o Nginx remove o prefixo) |

## Integrações externas

| Sistema | Protocolo | Onde | Tratamento de falha |
| --- | --- | --- | --- |
| Google OAuth 2.0 | HTTPS / OAuth Authorization Code | `auth.service.ts` | `state` assinado (JWT, 10 min) contra CSRF; retorno do app validado com a URL interpretada (Expo e localhost só fora de produção); nonce do navegador no fluxo web |
| Meilisearch | HTTP REST | `produtoSearchIndex.service.ts` | Fallback para busca SQL |
| Redis | RESP | `config/redis.ts` | Timeout, circuit breaker, fallback para o MySQL |
| Mercado Pago | HTTPS REST | planejado (v4) | Anticorruption Layer + eventos duráveis (Redis Streams) |

## Dados

- **Banco principal:** MySQL 8.4. Justificativa em [ADR 0002](adr/0002-banco-de-dados-mysql.md).
- **Cache:** Redis. Ver [ADR 0003](adr/0003-cache-redis-cache-aside.md).
- **Busca:** Meilisearch. Ver [ADR 0005](adr/0005-busca-meilisearch.md).
- **Arquivos (fotos):** volumes Docker `produto_fotos` e `avaliacao_fotos`, servidos como estáticos pela API.
- **Modelo relacional:** diagrama ER no [readme principal](../../readme.md) (seção *Diagrama Entidade Relacionamento*).
