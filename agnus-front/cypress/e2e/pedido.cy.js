describe('Pedidos cliente', () => {

    beforeEach(() => {

        localStorage.setItem(
            'auth_token',
            'fake'
        );

        localStorage.setItem(
            'auth',
            JSON.stringify({
                id_usuario: 1
            })
        );
    });

    it('não deve mostrar pedidos quando usuário não possui', () => {

        cy.intercept(
            'GET',
            '**/orders',
            {
                body: []
            }
        ).as('pedidos');

        cy.visit('/cliente/pedidos');

        cy.wait('@pedidos');

        cy.contains('Você ainda não possui pedidos.').should('exist');
    });

    it('deve ignorar pedidos de outros usuários', () => {

        cy.intercept(
            'GET',
            '**/orders',
            {
                body: [
                    {
                        id_pedido: 20,
                        id_usuario: 99,
                        status: 'Pago',
                        valor_total: 200
                    }
                ]
            }
        );

        cy.visit('/cliente/pedidos');

        cy.contains('Pedido #20').should('not.exist');
    });

    it('deve abrir e fechar detalhes do pedido', () => {

        cy.intercept(
            'GET',
            '**/orders',
            {
                body: [
                    {
                        id_pedido: 50,
                        id_usuario: 1,
                        status: 'Pago',
                        valor_total: 300
                    }
                ]
            }
        );

        cy.intercept(
            'GET',
            '**/order-items/50',
            {
                body: [
                    {
                        id_pedido_item: 1,
                        quantidade: 2,
                        subtotal: 300,
                        produto: {
                            nome: 'Tênis'
                        }
                    }
                ]
            }
        );

        cy.visit('/cliente/pedidos');

        cy.get('[data-cy="abrir-pedido"]')
            .click();

        cy.get('[data-cy="pedido-itens"]')
            .should('be.visible');

        cy.get('[data-cy="abrir-pedido"]')
            .click();

        cy.get('[data-cy="pedido-itens"]')
            .should('not.exist');
    });

    it('deve carregar pedido sem itens', () => {

        cy.intercept(
            'GET',
            '**/orders',
            {
                body: [
                    {
                        id_pedido: 60,
                        id_usuario: 1,
                        status: 'Pago',
                        valor_total: 100
                    }
                ]
            }
        );

        cy.intercept(
            'GET',
            '**/order-items/60',
            {
                body: []
            }
        );

        cy.visit('/cliente/pedidos');

        cy.get('[data-cy="pedido-card"]')
            .should('exist');
    });

    it('deve mostrar produto não encontrado', () => {

        cy.intercept(
            'GET',
            '**/orders',
            {
                body: [
                    {
                        id_pedido: 70,
                        id_usuario: 1,
                        status: 'Pago',
                        valor_total: 80
                    }
                ]
            }
        );

        cy.intercept(
            'GET',
            '**/order-items/70',
            {
                body: [
                    {
                        id_pedido_item: 1,
                        quantidade: 1,
                        subtotal: 80,
                        produto: null
                    }
                ]
            }
        );

        cy.visit('/cliente/pedidos');

        cy.get('[data-cy="abrir-pedido"]')
            .click();

        cy.get('[data-cy="item-produto"]')
            .should(
                'contain',
                'Produto não encontrado'
            );
    });

    it('deve listar vários pedidos', () => {

        cy.intercept(
            'GET',
            '**/orders',
            {
                body: [
                    {
                        id_pedido: 1,
                        id_usuario: 1,
                        status: 'Pago',
                        valor_total: 50
                    },
                    {
                        id_pedido: 2,
                        id_usuario: 1,
                        status: 'Enviado',
                        valor_total: 100
                    }
                ]
            }
        );

        cy.visit('/cliente/pedidos');

        cy.get('[data-cy="pedido-card"]')
            .should(
                'have.length',
                2
            );
    });

    it('deve deslogar quando token expirar', () => {

        cy.intercept(
            'GET',
            '**/orders',
            {
                statusCode: 401
            }
        );

        cy.visit('/cliente/pedidos');

        cy.url()
            .should(
                'include',
                '/login'
            );
    });

    it('deve tratar erro ao buscar pedidos', () => {
        cy.intercept('GET', '**/orders', {
            statusCode: 500,
            body: { message: 'Erro' }
        }).as('pedidosErro');

        cy.visit('/cliente/pedidos');

        cy.wait('@pedidosErro');

        cy.contains('Erro ao carregar pedidos.')
            .should('be.visible');
    });
});