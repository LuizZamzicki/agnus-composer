// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands.js'

// SKUs da YouDraw (seção do produto no admin): resposta vazia por padrão, para a tela não chamar a API
// real. Um spec que precise de outro retorno registra o próprio cy.intercept (o mais recente vence).
beforeEach(() => {
  // Aviso de cookies: os testes entram como quem já recusou, para o aviso não cobrir botões no
  // rodapé. O spec do aviso liga Cypress.env('perguntarCookies') para vê-lo.
  cy.on('window:before:load', (win) => {
    if (!Cypress.env('perguntarCookies') && !win.localStorage.getItem('agnus_cookies')) {
      win.localStorage.setItem('agnus_cookies', 'recusado');
    }
  });
  cy.intercept('GET', '**/products/*/skus', {
    body: { combinacoes: [], faltando: 0, integracao_ativa: false },
  });
});
