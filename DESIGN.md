# Design · Agnus — "Tempo Litúrgico"

Direção escolhida em 2026-11-02, entre quatro propostas comparadas em HTML (Tempo Litúrgico, Vitral, Ora et Labora, Moda premium clássica).

## Ideia

Pedra clara, letras de inscrição romana e texto de missal. A cor de destaque do site é a **cor do tempo litúrgico do dia**: verde no Tempo Comum, roxo no Advento e na Quaresma, branco e ouro no Natal e na Páscoa, vermelho em Pentecostes. Recusa o padrão de loja fitness (preto, amarelo-neon, caixa alta gritada) e o de grife genérica (branco frio, serifa de moda).

## Tokens (`agnus-front/src/index.css`)

| Token | Valor | Uso |
| --- | --- | --- |
| `--lit` | definido em runtime por `utils/liturgia.js` | cor do tempo litúrgico: faixa do cabeçalho, filetes, foco, seleção, hover das ações |
| `--stone` | `#ecebe7` | fundo da página (calcário claro, não creme) |
| `--stone-2` | `#e2e0db` | faixas e rodapé |
| `--paper` | `#f7f6f3` | superfícies elevadas, campos |
| `--ink` | `#1d1c1a` | texto e ação primária |
| `--ink-2` / `--muted` | `#3a3834` / `#5e5a54` | texto secundário |
| `--line` / `--line-soft` | `#cfccc5` / `#dddad4` | filetes e bordas |
| `--brass` | `#8a6a1f` | estrelas das avaliações, avisos |
| `--danger` / `--ok` | `#9b2c1f` / `#2f6a46` | erro / sucesso |

Cores dos tempos: Tempo Comum `#2f6a46`, Advento `#5b3a86`, Quaresma `#4e2f6e`, Natal e Páscoa `#7a5c17`, Pentecostes `#a1231c`, todas com contraste ≥ 4,5:1 tanto com o branco quanto com o fundo de pedra (verificado: a menor é o dourado, 5,2:1 sobre `--stone` e 6,2:1 com branco).

## Tema escuro (opcional)

O claro é o padrão da marca. O escuro segue a preferência do sistema ou a escolha no botão de sol/lua do cabeçalho, guardada no navegador (`data-theme` em `<html>`, `utils/tema.js`).

- Pedra escura, nunca preto puro: `--stone #1b1a18`, `--stone-2 #23221f`, `--paper #2a2926`, `--ink #ecebe7`, `--muted #a9a49b`, `--line #4a4741`.
- Cores do tempo mais claras, com 4,8:1 ou mais sobre `--paper`: Tempo Comum `#47a86d`, Advento `#a587cd`, Quaresma `#aa87ce`, Natal e Páscoa `#be8e1f`, Pentecostes `#e9736d`. Texto sobre elas fica escuro (`--on-lit`).
- Logos: escrita AGNUS branca (`escrita-clara.png`) e logo completo com escrita branca (`logo-completo-escuro.png`, de `docs/marca/agnus-logo-cordeiro-escuro.png`); o símbolo simplificado serve aos dois temas. A troca usa as classes `.so-tema-claro` e `.so-tema-escuro`.
- Fotos e molduras em arco ganham uma borda de uma cor só (`--line`) para não se perderem no fundo; selos que ficariam abaixo de 4,5:1 usam fundo neutro e borda.
- O painel administrativo não tem tema escuro.

## Tipografia (servidas pelo projeto via `@fontsource`)

- **Marcellus**: títulos.
- **Marcellus SC**: navegação, botões, preços e rótulos, sempre com espaçamento entre letras.
- **EB Garamond**: texto corrido, com itálico para frases e citações.
- **Fonte do sistema**: só no painel administrativo (`--f-ui`), que é superfície de trabalho.

## Marca (`src/img/marca/`, originais em `docs/marca/`)

- **Regra de tamanho**: o desenho detalhado é o normal; a versão simplificada só entra onde o espaço é muito pequeno.
- Detalhado: `logo-completo.png` (com a escrita, no rodapé e no login) e `emblema.png` (sem a escrita, na página 404).
- Simplificado: desenhado em `docs/marca/agnus-logo-simplificado.png` (AGNUS-209). Dele saem `simbolo.png` (corpo branco, contorno preto) com `escrita.png` no cabeçalho; `simbolo-claro.png` no painel, com fundo escuro (silhueta branca, traços vazados); favicon e ícones `logo192`/`logo512` com fundo `--ink`, na loja e no painel.
- O nome AGNUS sempre acompanha o símbolo no cabeçalho, para a marca ficar conhecida.
- **O Cordeiro é sempre branco.** Nunca usar silhueta preta nem inverter o símbolo por CSS.

## Componentes e regras

- **Arco**: fotos de destaque (página inicial, página da peça, login) em arco romano com moldura `--paper` de 10px.
- **Botões**: a ação principal (`.btn-agnus`, Entrar, Adicionar à sacola, Finalizar pedido) usa `--acao`: no tema claro é a cor do tempo litúrgico com texto branco e fica mais escura no hover; no escuro é a tinta clara e ganha a cor do tempo no hover. `.btn-agnus-ghost` é o contorno. Estados de seleção (tamanho e cor escolhidos, item ativo do menu) continuam em tinta. Cantos de 8px (`--radius`), também em campos e cartões.
- **Cartões de peça**: sem caixa, sem sombra; imagem 3:4 com cantos `--radius`, nome em Marcellus, preço em versalete. Só as fotos de destaque usam o arco.
- **Proibido**: rótulo pequeno acima de título, borda colorida grossa na lateral de cartões, degradê decorativo, emoji ou caractere Unicode no lugar de ícone (usar `lucide-react` com traço de 1,5).
- **Movimento**: uma entrada orquestrada na página inicial (título, filete, foto); demais transições de até 0,3s com `--ease-out`; botões respondem ao pressionar (escala 0,97, sem atraso); páginas, cartões, janelas e painéis entram com um leve fade; carregamento usa lugares reservados que pulsam, nunca texto solto ou brilho em gradiente; nenhuma animação mantém `transform` ao terminar (quebraria `position: fixed`); respeita `prefers-reduced-motion`.

## Arquivos

- Base: `src/index.css`, `src/utils/liturgia.js`.
- Loja: `css/cliente/header.css`, `footer.css`, `home.css`, `vitrine.css` (cartões e paginação), `catalogo.css`, `produto.css`, `carrinho.css`, `css/login.css`, `css/notFound.css`, `css/notification.css`.
- Área do cliente e admin: `css/cliente.css`, `css/admin-layout.css`, `css/admin-produtos.css` usam os mesmos tokens.
