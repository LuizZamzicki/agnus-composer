describe('Catálogo de produtos', () => {

    beforeEach(() => {

        localStorage.setItem(
            'auth_token',
            'fake-token'
        );

        localStorage.setItem(
            'auth',
            JSON.stringify({
                id_usuario: 1
            })
        );


        cy.intercept(
            'GET',
            '**/product-reviews/*',
            {
                statusCode: 200,
                body: []
            }
        );

    });


    function mockCategorias() {

        cy.intercept(
            'GET',
            '**/categories',
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_categoria: 1,
                            nome: 'Camisas'
                        }
                    ]
                }
            }
        )
            .as('categorias');

    }



    function mockProduto(nome = "Camisa Teste") {

        cy.intercept(
            'GET',
            '**/products/catalog?page=1&limit=12',
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_produto: 1,
                            nome,
                            preco_base: 99.90,
                            imagens: []
                        }
                    ],
                    pagination: {
                        totalPages: 1
                    }
                }
            }
        )
            .as('produtos');

    }




    it('deve carregar produtos no catálogo', () => {


        mockProduto();

        mockCategorias();


        cy.visit('/catalogo');


        cy.wait('@produtos');
        cy.wait('@categorias');


        cy.get('[data-cy^="produto-card-"]',
            { timeout: 10000 }
        )
            .should('have.length', 1);


        cy.contains('Camisa Teste')
            .should('exist');


    });




    it('deve buscar produto pelo nome', () => {


        cy.intercept(
            {
                method: 'GET',
                url: '**/products/catalog*',
                query: {
                    page: '1',
                    limit: '12',
                    search: 'camisa'
                }
            },
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_produto: 2,
                            nome: 'Camisa Preta',
                            preco_base: 120,
                            imagens: []
                        }
                    ],
                    pagination: {
                        totalPages: 1
                    }
                }
            }
        )
            .as('buscar');


        mockCategorias();


        cy.visit('/catalogo');


        cy.get('[data-cy="buscar-produto"]')
            .type('camisa');


        cy.wait('@buscar');

        cy.get('[data-cy^="produto-card-"]')
            .should('have.length', 1);

        cy.contains('Camisa Preta')
            .should('be.visible');


    });





    it('deve filtrar por categoria', () => {


        mockCategorias();


        cy.intercept(
            '**/products/catalog?page=1&limit=12&id_categoria=1',
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_produto: 5,
                            nome: 'Camisa Categoria',
                            preco_base: 80,
                            imagens: []
                        }
                    ],
                    pagination: {
                        totalPages: 1
                    }
                }
            }
        )
            .as('categoria');


        cy.visit('/catalogo');


        cy.contains('Camisas')
            .click();


        cy.wait('@categoria');


        cy.contains('Camisa Categoria')
            .should('exist');


    });





    it('deve ir para próxima página', () => {


        cy.intercept(
            '**/products/catalog?page=1&limit=12',
            {
                body: {
                    data: [
                        {
                            id_produto: 1,
                            nome: 'Produto Página 1',
                            preco_base: 50,
                            imagens: []
                        }
                    ],
                    pagination: {
                        totalPages: 2
                    }
                }
            }
        );


        cy.intercept(
            '**/products/catalog?page=2&limit=12',
            {
                body: {
                    data: [
                        {
                            id_produto: 2,
                            nome: 'Produto Página 2',
                            preco_base: 70,
                            imagens: []
                        }
                    ],
                    pagination: {
                        totalPages: 2
                    }
                }
            }
        )
            .as('pagina2');


        mockCategorias();


        cy.visit('/catalogo');


        cy.get('.pagination button')
            .last()
            .click();


        cy.wait('@pagina2');


        cy.contains('Produto Página 2')
            .should('exist');


    });





    it('deve ordenar produtos pelo menor preço', () => {


        cy.intercept(
            '**/products/catalog?page=1&limit=12',
            {
                body: {
                    data: [
                        {
                            id_produto: 1,
                            nome: 'Produto A',
                            preco_base: 200,
                            imagens: []
                        },
                        {
                            id_produto: 2,
                            nome: 'Produto B',
                            preco_base: 50,
                            imagens: []
                        }
                    ],
                    pagination: {
                        totalPages: 1
                    }
                }
            }
        );


        mockCategorias();


        cy.visit('/catalogo');


        cy.get('[data-cy="ordenar"]')
            .select('menor');


        cy.get('[data-cy^="produto-card-"]')
            .first()
            .should('contain.text', 'Produto B');


    });





    it('deve mostrar preço do produto', () => {


        mockProduto("Camisa Preta");

        mockCategorias();


        cy.visit('/catalogo');


        cy.contains('R$ 99,90')
            .should('exist');


    });





    it('deve abrir produto ao clicar no card', () => {


        mockProduto("Tênis Teste");

        mockCategorias();


        cy.visit('/catalogo');


        cy.get('[data-cy^="produto-card-"]')
            .first()
            .click();


        cy.url()
            .should(
                'include',
                '/produto/1'
            );


    });


});