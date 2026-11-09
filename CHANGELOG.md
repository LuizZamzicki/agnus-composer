# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e [SemVer](https://semver.org/lang/pt-BR/). Política em [docs/gestao/versionamento.md](docs/gestao/versionamento.md).

## [Não lançado] — 4.0.0

### Em andamento
- Integração de pagamento com Mercado Pago (US-25, US-26).

### Adicionado
- Notificações no site: um sino no cabeçalho avisa o cliente quando o status do pedido muda e leva direto ao pedido.
- Na tela de pedidos, botão para ver as peças e avaliar cada peça entregue, com foto.
- Pop-up de confirmação ao colocar uma peça na sacola.

### Alterado
- Quem já avaliou uma peça vê só "Alterar sua avaliação"; a nota é dada apenas pelas estrelas, com meia estrela.
- A lupa do cabeçalho abre o catálogo com a busca pronta para digitar.
- Administrador não vê mais o ícone de sacola.
- Notificação aberta some da lista e leva direto ao pedido.
- Site com mais resposta ao uso: botões reagem ao pressionar, páginas e cartões entram suavemente, carregamento com lugares reservados, contador da sacola reage e a busca espera o cliente parar de digitar.
- Estrelas da avaliação maiores, com prévia ao passar o mouse.
- Notificações ganham um ícone conforme o status do pedido.

### Corrigido
- Mensagens da API e textos do site voltam a ter acentos.
- O nome digitado na avaliação era descartado ao enviar.
- Ao trocar de página, a tela agora volta ao topo.
- A área de clique das estrelas, na tela de pedidos, ficava deslocada para baixo do desenho.
- O catálogo mostrava "Nenhuma peça encontrada" antes de os dados chegarem.
- A foto das peças não aparecia na tela de pedidos.
- Notificações de texto curto ficavam desalinhadas no painel.
- Uma resposta antiga da busca podia sobrescrever o resultado mais recente.

## [3.4.0] — 2026-11-06

### Segurança
- **Alta:** `POST /orders` deixava qualquer cliente autenticado criar um pedido para si com `valor_total` e `status` escolhidos por ele (ex.: `{"status":"pago","valor_total":0}`). Agora é o lançamento manual da equipe (permissão `pedidos:criar`): o pedido nasce aberto e o valor enviado é ignorado. O cliente compra só por `POST /orders/checkout`.
- **Alta:** `POST /order-items` deixava o cliente incluir peças no próprio pedido depois do checkout sem atualizar o total. Incluir, alterar e remover itens passou a ser exclusivo da equipe.
- **Alta:** o retorno do login Google comparava só o início do texto, então `http://localhost.atacante.com` recebia o token da vítima. A URL agora é interpretada antes da decisão, e Expo e localhost só valem fora de produção (`NODE_ENV=production`).
- Conta local criada antes com o mesmo e-mail deixa de manter a senha ao ser vinculada ao Google: o cadastro não comprova o e-mail, e a senha podia ser de outra pessoa.
- Um link com `/login?token=` não troca mais a sessão: o site só aceita o retorno de um login que o próprio navegador começou.
- `PUT /users/:id` não aceita mais `senha`; a troca passa só por `PATCH /users/:id/password`, que confere a senha atual e o histórico.
- Avaliação exige pedido entregue com o produto, uma por produto, nota de 0,5 a 5 (meia estrela) e não muda de produto na edição.
- Custo e margem saem das respostas públicas de `GET /products` e `GET /products/:id`; continuam disponíveis para administradores.
- Limite por IP na própria API: 10 logins e 5 cadastros por minuto, inclusive pelo ngrok e em variações da rota. Os e-mails têm tamanho máximo antes da validação, e o upload de fotos de avaliação aceita até 4 arquivos por requisição.
- Painel do ngrok (porta 4040) só na máquina local.
- Nginx limita as tentativas de login a 10 por minuto por IP (rajada de 5); acima disso responde 429.
- A porta 3000 da API fica presa a `127.0.0.1`: de fora, a API só é acessível pelo Nginx (TLS e cabeçalhos de segurança).

### Adicionado
- Máquina de estados do pedido: `aguardando_calculo_frete → aguardando_pagamento → pago → enviado → entregue`, com `cancelado` antes do envio. Transição inválida retorna 409 (US-23).
- `valor_total` sempre recalculado no servidor (itens + frete) quando itens ou frete mudam (conclui a US-22).
- Itens de pedido só mudam com o pedido em aberto; depois do pagamento a API responde 409.
- Nginx com upstream e keepalive, timeouts de proxy, gzip e cache longo para os arquivos com hash do build.
- OpenAPI com itens de pedido, contatos, cores, grades e avaliações, além das respostas 403/409 dos pedidos.
- Roteiro para validar cada item da rubrica ([docs/validacao-rubrica.md](docs/validacao-rubrica.md)) e script `npm run validar:rubrica`, que confere 16 comportamentos de back-end contra a stack em execução.

### Alterado
- Rotas da API organizadas em um módulo por bounded context (`agnus-back/src/routes/`); o `app.ts` só monta middlewares, documentação e rotas.
- A coleção Postman passa a ser gerada a partir de `src/routes/*.routes.ts`.
- RFs de estoque (RF24–RF26, RF56–RF57, RF97) marcados como substituídos no readme (print on demand, US-29).

### Corrigido
- CI vermelho na `main` desde a remoção do `node_modules` do Git: o ESLint do front usa o `eslint.config.js` da raiz, cujas dependências (`@eslint/js`, `globals`) não eram instaladas no job. Agora estão declaradas no `package.json` da raiz e o job as instala.
- O primeiro evento recebido pelo worker depois de cada reinício se perdia (nem auditoria, nem notificação): a conexão de comandos do Redis só abria no primeiro evento e, sem fila offline, o `LPUSH` falhava. O worker agora espera a conexão antes de assinar os canais, e uma falha na auditoria não impede mais a notificação.
- Fotos de avaliação não ficam mais órfãs no disco: o arquivo só é gravado depois das validações e é apagado ao trocar ou remover a foto.
- A chave de cache codifica nomes e valores da URL, evitando que uma consulta forjada ocupe a chave de outra.
- O redirect após o login só aceita caminhos do próprio site.
- Criar, editar ou remover cor ou grade não invalidava o cache de produtos (o novo acréscimo de preço podia levar até 5 min para aparecer).
- Relatórios gerados (`agnus-back/coverage/`, `debug.log`) saíram do versionamento.
- Documentação alinhada ao código (checkout em `POST /orders/checkout`, número de testes, invariantes do agregado Pedido).

## [3.3.0] — 2026-11-03

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
