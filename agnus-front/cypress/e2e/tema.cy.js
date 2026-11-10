describe('Tema escuro', () => {
    const partirDoClaro = { onBeforeLoad(win) { win.localStorage.setItem('agnus_tema', 'light'); } };

    it('alterna pelo botão do cabeçalho e guarda a escolha', () => {
        cy.visit('/', partirDoClaro);
        cy.get('html').should('have.attr', 'data-theme', 'light');
        cy.get('[data-cy="alternar-tema"]').should('have.attr', 'aria-label', 'Usar tema escuro').click();
        cy.get('html').should('have.attr', 'data-theme', 'dark');
        cy.reload();
        cy.get('html').should('have.attr', 'data-theme', 'dark');
        cy.get('[data-cy="alternar-tema"]').should('have.attr', 'aria-label', 'Usar tema claro').click();
        cy.get('html').should('have.attr', 'data-theme', 'light');
    });

    it('troca o fundo e a escrita do logo conforme o tema', () => {
        cy.visit('/', partirDoClaro);
        cy.get('body').should('have.css', 'background-color', 'rgb(236, 235, 231)');
        cy.get('.logo-escrita.so-tema-claro').should('be.visible');
        cy.get('[data-cy="alternar-tema"]').click();
        cy.get('body').should('have.css', 'background-color', 'rgb(27, 26, 24)');
        cy.get('.logo-escrita.so-tema-escuro').should('be.visible');
        cy.get('.logo-escrita.so-tema-claro').should('not.be.visible');
    });
});
