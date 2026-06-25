describe('Página Home', () => {

    beforeEach(() => {

        cy.intercept('GET', '**/products/best-sellers*', {
            body: {
                data: [
                    {
                        id_produto: 1,
                        nome: 'Produto Destaque',
                        preco_base: 99.9,
                        imagens: []
                    }
                ]
            }
        }).as('bestSellers');

        cy.intercept('GET', '**/products/catalog*', {
            body: {
                data: [
                    {
                        id_produto: 2,
                        nome: 'Produto Home',
                        preco_base: 120,
                        imagens: []
                    }
                ],
                pagination: {
                    totalPages: 1
                }
            }
        }).as('catalog');

        cy.intercept('GET', '**/categories*', {
            body: {
                data: []
            }
        }).as('categories');

        cy.intercept('GET', '**/product-reviews/*', {
            body: []
        }).as('reviews');

        cy.visit('/');

        cy.wait('@bestSellers');
        cy.wait('@catalog');
    });

    it('deve carregar a página inicial', () => {

        cy.get('[data-cy="home-page"]')
            .should('be.visible');
    });

    it('deve possuir botão para acessar catálogo', () => {

        cy.get('[data-cy="ver-colecao"]')
            .should('be.visible')
            .and('contain', 'VER COLEÇÃO');
    });

    it('deve navegar para catálogo ao clicar no botão', () => {

        cy.get('[data-cy="ver-colecao"]')
            .click();

        cy.url().should('include', '/catalogo');

    });

    it('deve exibir produtos na home', () => {
        cy.get('[data-cy="produto-card-home"]', { timeout: 10000 })
            .should('have.length.greaterThan', 0);
    });

    it('deve permitir clicar em um produto', () => {

        cy.get('[data-cy="produto-card-home"]', { timeout: 10000 })
            .first()
            .should('be.visible')
            .click();

        cy.url().should('include', '/produto/');

    });

    it('deve possuir filtro todos', () => {

        cy.get('[data-cy="filtro-todos"]')
            .should('be.visible');

    });

});