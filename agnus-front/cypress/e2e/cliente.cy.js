describe('Área do cliente', () => {

    function loginMock(google = false) {
        cy.visit('/cliente', {
            onBeforeLoad(win) {
                win.localStorage.setItem('auth_token', 'fake');
                win.localStorage.setItem('auth', JSON.stringify({
                    user: {
                        id_usuario: 1,
                        nome: "Teste",
                        email: google ? "teste@gmail.com" : "teste@email.com",
                        tipo: "cliente",
                        ...(google && { google_id: "123" })
                    }
                }));
            }
        });

        cy.get('[data-cy="menu-perfil"]', { timeout: 20000 })
            .should('be.visible');
    }

    beforeEach(() => {
        cy.clearLocalStorage();

        // 🔁 Mockar TODAS as APIs que podem ser chamadas
        // Antes de fazer login/visit

        cy.intercept("GET", "**/api/users/**", {
            statusCode: 200,
            body: {
                id_usuario: 1,
                nome: "Teste",
                email: "teste@email.com",
                tipo: "cliente"
            }
        }).as("getUser");

        cy.intercept("GET", "**/users/**", {
            statusCode: 200,
            body: {
                id_usuario: 1,
                nome: "Teste",
                email: "teste@email.com",
                tipo: "cliente"
            }
        }).as("getUsers");

        cy.intercept("GET", "**/orders*", {
            statusCode: 200,
            body: []
        }).as("getOrders");

        cy.intercept("GET", "**/order-items/**", {
            statusCode: 200,
            body: []
        }).as("getOrderItems");

        cy.intercept("GET", "**/pedidos*", {
            statusCode: 200,
            body: []
        }).as("getPedidos");

        cy.intercept("GET", "**/enderecos*", {
            statusCode: 200,
            body: []
        }).as("getEnderecos");

        cy.intercept("GET", "**/contatos*", {
            statusCode: 200,
            body: []
        }).as("getContatos");

        cy.intercept("GET", "**/products*", {
            statusCode: 200,
            body: {
                data: [],
                pagination: { total: 0 }
            }
        }).as("getProducts");

        loginMock();
    });

    it('deve carregar menu cliente', () => {
        cy.get('[data-cy="menu-perfil"]')
            .should('be.visible');

        cy.get('[data-cy="menu-pedidos"]')
            .should('be.visible');

        cy.get('[data-cy="menu-enderecos"]')
            .should('be.visible');

        cy.get('[data-cy="menu-contatos"]')
            .should('be.visible');

        cy.get('[data-cy="logout"]')
            .should('be.visible');
    });

    it('deve navegar para pedidos', () => {
        cy.get('[data-cy="menu-pedidos"]')
            .should('be.visible')
            .click();

        cy.location('pathname', { timeout: 10000 })
            .should('eq', '/cliente/pedidos');
    });

    it('deve navegar para endereços', () => {
        cy.get('[data-cy="menu-enderecos"]')
            .should('be.visible')
            .click();

        cy.location('pathname', { timeout: 10000 })
            .should('eq', '/cliente/enderecos');
    });

    it('deve navegar para contatos', () => {
        cy.get('[data-cy="menu-contatos"]')
            .should('be.visible')
            .click();

        cy.location('pathname', { timeout: 10000 })
            .should('eq', '/cliente/contatos');
    });

    it('deve fazer logout', () => {
        cy.get('[data-cy="logout"]')
            .should('be.visible')
            .click();

        cy.location('pathname', { timeout: 10000 })
            .should('eq', '/login');

        cy.window().then(win => {
            expect(win.localStorage.getItem('auth')).to.be.null;
            expect(win.localStorage.getItem('auth_token')).to.be.null;
        });
    });

    it('não deve mostrar senha para usuário google', () => {
        cy.clearLocalStorage();
        loginMock(true);

        cy.get('[data-cy="menu-senha"]')
            .should('not.exist');
    });

});