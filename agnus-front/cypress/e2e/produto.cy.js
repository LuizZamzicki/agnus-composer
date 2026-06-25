describe('Catálogo de produtos', () => {

    beforeEach(() => {

        cy.intercept(
            'GET',
            '**/products/catalog*',
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_produto: 1,
                            nome: 'Camiseta Fé',
                            preco_base: 79.90,
                            imagens: []
                        },
                        {
                            id_produto: 2,
                            nome: 'Moletom Agnus',
                            preco_base: 199.90,
                            imagens: []
                        }
                    ],
                    pagination: {
                        totalPages: 1
                    }
                }
            }
        ).as('produtos');

        cy.intercept(
            'GET',
            '**/categories',
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_categoria: 1,
                            nome: 'Camisetas'
                        }
                    ]
                }
            }
        ).as('categorias');

        cy.intercept(
            'GET',
            '**/product-reviews/*',
            {
                statusCode: 200,
                body: [
                    {
                        nota: 8
                    }
                ]
            }
        ).as('avaliacoes');
    });

    it('deve listar produtos', () => {
        cy.visit('/catalogo');

        cy.wait('@produtos');

        cy.contains('Camiseta Fé')
            .should('exist');

        cy.contains('Moletom Agnus')
            .should('exist');
    });

    it('deve buscar produto', () => {
        cy.visit('/catalogo');

        cy.get('input[placeholder="Buscar produto..."]')
            .type('Camiseta');

        cy.contains('Camiseta Fé')
            .should('exist');

    });

    it('deve filtrar por categoria', () => {
        cy.visit('/catalogo');

        cy.contains('Camisetas')
            .click();

        cy.wait('@produtos');

        cy.contains('Camiseta Fé')
            .should('exist');

    });

    it('deve ordenar menor preço', () => {
        cy.visit('/catalogo');

        cy.get('select')
            .select('menor');

        cy.get('.product-card')
            .first()
            .should('contain', 'Camiseta Fé');

    });

    it('deve abrir detalhe do produto', () => {

        cy.visit('/catalogo');

        cy.contains('Camiseta Fé')
            .click();

        cy.url()
            .should(
                'include',
                '/produto/1'
            );
    });

    it('não deve mostrar produtos quando catálogo vazio', () => {

        cy.intercept(
            'GET',
            '**/products/catalog*',
            {
                statusCode: 200,
                body: {
                    data: [],
                    pagination: {
                        totalPages: 0
                    }
                }
            }
        ).as('produtosVazio');

        cy.visit('/catalogo');

        cy.wait('@produtosVazio');

        cy.get('.product-card')
            .should('not.exist');
    });

    it('deve mostrar preço formatado corretamente', () => {

        cy.visit('/catalogo');

        cy.wait('@produtos');

        cy.contains('R$ 79,90')
            .should('exist');
    });

    it('deve mostrar mais de uma categoria', () => {

        cy.intercept(
            'GET',
            '**/categories*',
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_categoria: 1,
                            nome: 'Camisetas'
                        },
                        {
                            id_categoria: 2,
                            nome: 'Moletons'
                        }
                    ]
                }
            }
        ).as('categorias');

        cy.visit('/catalogo');

        cy.wait('@categorias');

        cy.contains('Camisetas')
            .should('exist');

        cy.contains('Moletons')
            .should('exist');
    });

    it('deve ordenar maior preço', () => {

        cy.visit('/catalogo');

        cy.wait('@produtos');

        cy.get('select')
            .select('maior');

        cy.get('.product-card')
            .first()
            .should('contain', 'Moletom Agnus');
    });

    it('deve manter produto após limpar busca', () => {

        cy.visit('/catalogo');

        cy.wait('@produtos');

        cy.get('input[placeholder="Buscar produto..."]')
            .type('Camiseta');

        cy.contains('Camiseta Fé')
            .should('exist');

        cy.get('input[placeholder="Buscar produto..."]')
            .clear();

        cy.contains('Moletom Agnus')
            .should('exist');
    });

    it('deve carregar imagem do produto quando existir', () => {

        cy.intercept(
            'GET',
            '**/products/catalog*',
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_produto: 1,
                            nome: 'Camiseta Fé',
                            preco_base: 79.90,
                            imagem: 'teste.jpg'
                        }
                    ]
                }
            }
        ).as('produtoImagem');

        cy.visit('/catalogo');

        cy.wait('@produtoImagem');

        cy.contains('Camiseta Fé')
            .should('exist');
    });

    it('deve tratar erro ao carregar catálogo', () => {

        cy.intercept(
            'GET',
            '**/products/catalog*',
            {
                statusCode: 500,
                body: {
                    message: 'Erro'
                }
            }
        ).as('erroProdutos');

        cy.visit('/catalogo');

        cy.wait('@erroProdutos');

        cy.get('.product-card')
            .should('not.exist');

    });
});