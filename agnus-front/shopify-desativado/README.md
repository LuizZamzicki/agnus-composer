# Integração Shopify (desativada)

A loja deixou de usar o Shopify headless: vitrine, sacola e checkout voltaram a ser do próprio site, e o pagamento passa a ser pelo Mercado Pago. O código da integração fica guardado aqui para consulta ou para religar no futuro. Nada desta pasta é compilado nem testado: o React só compila o que está em `src/`, e o Cypress só roda `cypress/e2e/`.

## O que tem aqui

- `src/`: as versões das telas e utilitários que falavam com o serviço `loja` (`/api/loja`): `App.tsx` com as rotas de compatibilidade do Shopify, cabeçalho, home, catálogo, peça, sacola, "Meus pedidos", CSS e os utilitários `loja.js`, `useVitrine.js`, `sacola.js` e `cartaoProduto.jsx`.
- `cypress/`: specs dos redirecionamentos do Shopify e dos pedidos da loja online.

As versões de `src/` foram recuperadas do último build publicado (mapas de código-fonte), porque essa parte não chegou a ser commitada. Os testes Cypress das telas da vitrine Shopify (home, catálogo, peça e sacola) não puderam ser recuperados.

## Como religar

1. Backend: veja `services/loja/README.md`.
2. Copie os arquivos de `src/` desta pasta por cima dos de `agnus-front/src/` (as telas atuais usam `catalogo`, `carrinho` e `pedidos`) e as specs de `cypress/` para `agnus-front/cypress/`.
