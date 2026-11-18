import { regata } from '../support/loja';

// O tema do Shopify reenvia quem clica em "Voltar à loja" no checkout para o site, mantendo o caminho.
describe('Endereços no formato da loja do Shopify', () => {
    beforeEach(() => {
        cy.intercept('GET', '**/loja/**', { body: { produtos: [], paginacao: {} } });
        cy.intercept('GET', '**/loja/colecoes', { body: [] });
    });

    it('a página inicial do Shopify abre a página inicial do site', () => {
        cy.visit('/');
        cy.get('[data-cy="home-page"]').should('exist');
    });

    it('/products/:handle abre a peça', () => {
        cy.intercept('GET', '**/loja/produtos/regata-crucifixo', { body: regata() });
        cy.intercept('GET', '**/loja/produtos/regata-crucifixo/relacionados', { body: [] });
        cy.intercept('GET', '**/product-reviews/*', { body: [] });

        cy.visit('/products/regata-crucifixo');
        cy.location('pathname').should('eq', '/produto/regata-crucifixo');
        cy.contains('h1', 'Regata Crucifixo').should('exist');
    });

    it('tira o idioma que o Shopify põe no caminho ("Voltar à loja" em português)', () => {
        cy.visit('/pt');
        cy.location('pathname').should('eq', '/');
        cy.get('[data-cy="home-page"]').should('exist');

        cy.intercept('GET', '**/loja/produtos/regata-crucifixo', { body: regata() });
        cy.intercept('GET', '**/loja/produtos/regata-crucifixo/relacionados', { body: [] });
        cy.intercept('GET', '**/product-reviews/*', { body: [] });
        cy.visit('/pt-br/products/regata-crucifixo');
        cy.location('pathname').should('eq', '/produto/regata-crucifixo');
    });

    it('barras repetidas depois do idioma não levam para outro site', () => {
        cy.visit('/pt//exemplo.invalid');
        cy.location('origin').should('eq', new URL(Cypress.config('baseUrl')).origin);
        cy.location('pathname').should('eq', '/exemplo.invalid');
    });

    it('/collections e /cart levam à coleção e à sacola', () => {
        cy.visit('/collections/all');
        cy.location('pathname').should('eq', '/catalogo');

        cy.visit('/cart');
        cy.location('pathname').should('eq', '/carrinho');
    });
});
