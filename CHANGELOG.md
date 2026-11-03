# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [SemVer](https://semver.org/lang/pt-BR/). Política em [docs/gestao/versionamento.md](docs/gestao/versionamento.md).

## [Não lançado] — 4.0.0

### Em andamento
- Integração de pagamento com Mercado Pago (US-25, US-26).

### Alterado — fluxo de compra simplificado
- Sacola sem exigir conta: o visitante escolhe primeiro e entra só ao finalizar; as peças passam para a conta no login, inclusive quando a sessão vence no meio da compra.
- Sacola sem caixas de seleção: tudo o que está nela entra no pedido e o total aparece certo desde o início.
- Página única de finalizar (`/finalizar`), com endereço na própria página e preenchimento automático pelo CEP (ViaCEP), e confirmação com o número do pedido e o próximo passo (`/pedido-confirmado/:id`).
- Página da peça: cor ou tamanho únicos já vêm marcados, o aviso aparece ao lado do seletor, a confirmação traz o caminho para a sacola e o cabeçalho mostra a quantidade de peças.
- Cadastro entra direto na conta; o login com Google volta para onde o cliente estava.
- Novo `POST /orders/checkout`: total calculado no servidor; pedido, itens e baixa da sacola na mesma transação (US-22).

### Alterado — nova identidade visual "Tempo Litúrgico"
- Logotipo oficial (cordeiro com auréola e estandarte) no cabeçalho, rodapé, login, página 404, painel e ícones; título e idioma da página corrigidos.
- Site inteiro redesenhado (loja, login, área do cliente, painel admin): pedra clara, tipografia de inscrição romana (Marcellus) e de missal (EB Garamond), fontes servidas pelo próprio projeto.
- A cor de destaque acompanha o tempo litúrgico do dia (`utils/liturgia.js`), exibido numa faixa abaixo do cabeçalho.
- Textos revistos: o sagrado à frente, sem linguagem de academia; citações bíblicas pontuais.
- Acessibilidade: cartões de produto e ações viraram links/botões reais, ícones com rótulo, foco visível na cor do tempo.
- Área do cliente passa a funcionar no celular (antes estourava a largura da tela).
- Página 404 com a parábola da ovelha perdida.

## [3.3.0] — 2026-11-02

### Adicionado
- Cache distribuído com **Redis** no padrão cache-aside, com TTL por tipo de dado, para produtos (lista, catálogo, mais vendidos, detalhe) e categorias.
- Invalidação do cache em criação, edição e remoção de produtos, categorias e fotos.
- **Mensageria com Redis Pub/Sub**: eventos `produto.*`, `categoria.*` e `pedido.*`.
- Container **worker** que consome os eventos, grava a trilha de auditoria e registra notificações.
- **Logs estruturados em JSON** com `X-Request-Id` propagado do Nginx até o worker.
- Endpoint `GET /metrics` (latência p50/p95/p99, disponibilidade, taxa de acerto do cache).
- Especificação **OpenAPI** (`agnus-back/openapi.yaml`) e Swagger UI em `/api/docs/`.
- Pipeline de **CD** (`.github/workflows/cd.yml`) com imagens versionadas e rollback automático.
- Documentação de arquitetura (C4, ADRs, quality scenarios, DDD, SLOs, runbook) e de gestão (Cynefin, backlog, Jira).

### Corrigido
- Clientes não conseguiam ver os próprios pedidos (a tela "Meus pedidos" deslogava o usuário) nem avaliar produtos comprados: as duas telas usavam `GET /orders`, que é exclusivo de administradores. Nova rota `GET /orders/me` devolve apenas os pedidos do usuário do token.
- JSON malformado no corpo da requisição retornava 500; agora retorna 400.
- Healthcheck do Nginx sempre `unhealthy`: `localhost` resolvia para IPv6 dentro do container.
- Erros 500 não eram registrados em log.

### Resiliência
- Timeout de 500 ms, circuit breaker e fallback para o MySQL quando o Redis está indisponível.

### Segurança
- **Alta:** rotas de endereços, contatos, avaliações (e fotos), carrinhos, itens de carrinho e itens de pedido não exigiam autenticação nem verificavam o dono. Agora exigem token e só aceitam o dono ou um administrador; alterar/remover itens de pedido é exclusivo de administradores, e itens só entram em pedidos ainda não pagos.
- Upload de imagens passa a validar o **conteúdo** (magic bytes). Arquivos renomeados (ex.: HTML ou executável como `.png`) são recusados, e a extensão gravada é a do formato real.
- Login não informa mais se a senha errada já foi usada antes (evita confirmar senhas antigas vazadas).
- `GET /metrics` restrito a administradores.
- Frontend envia o token nas chamadas de carrinho, checkout e avaliações (o checkout também deixava de enviar o token para `POST /orders`).

## [3.2.1] — 2026-09-17
### Adicionado
- ngrok sobe junto com o docker compose (#9).
### Corrigido
- CI do frontend (#9).

## [3.2.0] — 2026-09-17
### Adicionado
- Upload de imagens via Multer com validação de tipo e tamanho (#8).
- Controle de acesso administrador/usuário nas rotas (#8).

## [3.1.0] — 2026-09-16
### Adicionado
- Ordenação do catálogo por preço (#6, #7).
- Script de seed de produtos.
- Requisitos funcionais e não funcionais no readme (#2–#5).

## [3.0.0] — 2026-09-08
### Adicionado
- Login com Google no app mobile via `redirect` validado no OAuth.

## [2.2.0] — 2026-08-31
### Adicionado
- Workflow de CI e template de pull request (#1).
- Nginx como serviço dedicado no compose.

## [2.1.0] — 2026-06-25
### Adicionado
- Husky, ESLint e Commitlint.

## [2.0.0] — 2026-06-16
### Adicionado
- E-commerce: cadastro e login, catálogo com cores, grades e fotos, carrinho, pedidos, endereços, avaliações e painel administrativo.
