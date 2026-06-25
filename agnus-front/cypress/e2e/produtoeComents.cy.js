describe('Produto - avaliações', () => {


    beforeEach(() => {

        localStorage.setItem(
            'auth',
            JSON.stringify({
                id_usuario: 1,
                nome: 'Bruno'
            })
        );


        localStorage.setItem(
            'auth_token',
            'fake-token'
        );

    });



    function mockProduto() {


        cy.intercept(
            'GET',
            '**/products/1',
            {
                statusCode: 200,
                body: {
                    id_produto: 1,
                    nome: 'Camisa Teste',
                    descricao: 'Produto teste',
                    preco_base: 100
                }
            }
        ).as('produto');



        cy.intercept(
            'GET',
            '**/product-colors/1',
            {
                statusCode: 200,
                body: [
                    {
                        id_produto_cor: 1,
                        id_produto: 1,
                        nome: 'Azul Lunar',
                        codigo_rgb: 'rgb(26,47,209)',
                        acrescimo: "0.00"
                    }
                ]
            }
        ).as('cores');



        cy.intercept(
            'GET',
            '**/product-grades/1',
            {
                statusCode: 200,
                body: [
                    {
                        id_produto_grade: 1,
                        id_produto: 1,
                        nome: 'M',
                        acrescimo: "0.00"
                    }
                ]
            }
        ).as('grades');



        cy.intercept(
            'GET',
            '**/product-photos/1',
            {
                statusCode: 200,
                body: [
                    {
                        id_produto_foto: 1,
                        id_produto: 1,
                        id_produto_cor: 1,
                        caminho_url: 'produto_fotos/teste.png'
                    }
                ]
            }
        ).as('fotos');



        cy.intercept(
            'GET',
            '**/product-reviews/1',
            {
                statusCode: 200,
                body: []
            }
        ).as('reviews');

    }





    it('deve carregar produto corretamente', () => {


        mockProduto();


        cy.visit('/produto/1');


        cy.wait('@produto');


        cy.contains('Camisa Teste')
            .should('exist');


    });






    it('deve permitir enviar avaliação', () => {


        mockProduto();



        cy.intercept(
            'GET',
            '**/orders**',
            {
                statusCode: 200,
                body: [
                    {
                        id_pedido: 10,
                        status: 'entregue'
                    }
                ]
            }
        );



        cy.intercept(
            'GET',
            '**/order-items/10',
            {
                statusCode: 200,
                body: [
                    {
                        id_produto_cor: 1,
                        id_produto_grade: 1
                    }
                ]
            }
        );



        cy.intercept(
            'POST',
            '**/product-reviews',
            {
                statusCode: 200,
                body: {
                    id_avaliacao_produto: 5
                }
            }
        ).as('enviarReview');



        cy.visit('/produto/1');



        cy.get('[data-cy="escrever-avaliacao"]',
            {
                timeout: 10000
            }
        )
            .should('be.visible')
            .click();




        cy.get('[data-cy="nota-avaliacao"]')
            .clear()
            .type('5');



        cy.get('[data-cy="comentario-avaliacao"]')
            .type('Produto excelente');



        cy.get('[data-cy="enviar-avaliacao"]')
            .click();




        cy.wait('@enviarReview')
            .its('response.statusCode')
            .should('eq', 200);



        cy.get('[data-cy="produto-alerta"]')
            .should(
                'contain',
                'Avaliação enviada'
            );


    });








    it('não deve enviar avaliação sem comentário', () => {



        mockProduto();



        cy.intercept(
            'GET',
            '**/orders**',
            {
                body: [
                    {
                        id_pedido: 10,
                        status: 'entregue'
                    }
                ]
            }
        );



        cy.intercept(
            'GET',
            '**/order-items/10',
            {
                body: [
                    {
                        id_produto_cor: 1,
                        id_produto_grade: 1
                    }
                ]
            }
        );



        cy.visit('/produto/1');




        cy.get('[data-cy="escrever-avaliacao"]',
            {
                timeout: 10000
            }
        )
            .should('be.visible')
            .click();



        cy.get('[data-cy="nota-avaliacao"]')
            .type('5');



        cy.get('[data-cy="enviar-avaliacao"]')
            .click();



        cy.get('[data-cy="produto-alerta"]')
            .should(
                'contain',
                'Digite um comentário'
            );

    });









    it('deve adicionar produto no carrinho', () => {



        mockProduto();




        cy.intercept(
            'GET',
            '**/carts?id_usuario=1',
            {
                statusCode: 200,
                body: []
            }
        ).as('buscarCarrinho');




        cy.intercept(
            'POST',
            '**/carts',
            {
                statusCode: 200,
                body: {
                    id_carrinho: 1
                }
            }
        ).as('criarCarrinho');




        cy.intercept(
            'GET',
            '**/cart-items/1',
            {
                statusCode: 200,
                body: []
            }
        );




        cy.intercept(
            'POST',
            '**/cart-items',
            {
                statusCode: 200,
                body: {
                    id_item: 1
                }
            }
        ).as('addCarrinho');




        cy.visit('/produto/1');



        cy.wait('@produto');
        cy.wait('@cores');
        cy.wait('@grades');

        cy.get('[data-cy="adicionar-carrinho"]',
            {
                timeout: 10000
            }
        )
            .should('not.be.disabled')
            .click();



        cy.wait('@buscarCarrinho');

        cy.wait('@criarCarrinho');



        cy.wait('@addCarrinho')
            .its('response.statusCode')
            .should('eq', 200);



    });


});