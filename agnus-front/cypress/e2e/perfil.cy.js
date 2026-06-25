describe('Perfil cliente', () => {

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
    });

    it('deve carregar perfil', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                statusCode: 200,
                body: {
                    id_usuario: 1,
                    nome: 'Bruno',
                    email: 'teste@email.com',
                    cpf: '12345678900'
                }
            }
        ).as('perfil');

        cy.visit('/cliente', {
            onBeforeLoad(win) {
                win.localStorage.setItem('auth_token', 'fake-token');
                win.localStorage.setItem(
                    'auth',
                    JSON.stringify({
                        id_usuario: 1
                    })
                );
            }
        });

        cy.pause();

        cy.wait('@perfil');

        cy.get('[data-cy="titulo-perfil"]')
            .should('exist');

        cy.get('[data-cy="nome-perfil"]')
            .should('have.value', 'Bruno');

        cy.get('[data-cy="email-perfil"]')
            .should('have.value', 'teste@email.com');

        cy.get('[data-cy="cpf-perfil"]')
            .should('have.value', '12345678900');
    });

    it('deve mostrar erro ao carregar perfil', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                statusCode: 500,
                body: {
                    message: 'Erro'
                }
            }
        ).as('perfilErro');

        cy.visit('/cliente');

        cy.wait('@perfilErro');

        cy.get('[data-cy="error-message"]')
            .should('be.visible')
            .and('contain', 'Erro');
    });

    it('deve deslogar quando token expirar', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                statusCode: 401
            }
        ).as('perfil401');

        cy.visit('/cliente');

        cy.wait('@perfil401');

        cy.url()
            .should('include', '/login');
    });

    it('não deve salvar sem alterar nome', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                body: {
                    id_usuario: 1,
                    nome: 'Bruno',
                    email: 'teste@email.com',
                    cpf: '123'
                }
            }
        );

        cy.visit('/cliente');

        cy.get('[data-cy="salvar-perfil"]')
            .should('be.disabled');
    });

    it('deve salvar nome com tamanho mínimo válido', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                body: {
                    id_usuario: 1,
                    nome: 'Bruno',
                    email: 'teste@email.com',
                    cpf: '123'
                }
            }
        );

        cy.intercept(
            'PUT',
            '**/users/1',
            {
                statusCode: 200,
                body: {}
            }
        ).as('salvar');

        cy.visit('/cliente');

        cy.get('[data-cy="nome-perfil"]')
            .clear()
            .type('Ana');

        cy.get('[data-cy="salvar-perfil"]')
            .click();

        cy.wait('@salvar');

        cy.get('[data-cy="success-message"]')
            .should('contain', 'Nome atualizado');
    });

    it('deve mostrar erro quando API rejeitar atualização', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                body: {
                    id_usuario: 1,
                    nome: 'Bruno',
                    email: 'teste@email.com',
                    cpf: '123'
                }
            }
        );

        cy.intercept(
            'PUT',
            '**/users/1',
            {
                statusCode: 400,
                body: {
                    message: 'Nome inválido'
                }
            }
        ).as('editarErro');

        cy.visit('/cliente');

        cy.get('[data-cy="nome-perfil"]')
            .clear()
            .type('Bruno Novo');

        cy.get('[data-cy="salvar-perfil"]')
            .click();

        cy.wait('@editarErro');

        cy.get('[data-cy="error-message"]')
            .should('contain', 'Nome inválido');
    });

    it('deve mostrar botão salvando enquanto envia', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                body: {
                    nome: 'Bruno',
                    email: 'teste@email.com',
                    cpf: '123'
                }
            }
        );

        cy.intercept(
            'PUT',
            '**/users/1',
            {
                delay: 1000,
                statusCode: 200,
                body: {}
            }
        ).as('editar');

        cy.visit('/cliente');

        cy.get('[data-cy="nome-perfil"]')
            .clear()
            .type('Bruno Novo');

        cy.get('[data-cy="salvar-perfil"]')
            .click();

        cy.get('[data-cy="salvar-perfil"]')
            .should('contain', 'Salvando');

        cy.wait('@editar');
    });

    it('deve editar nome', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                statusCode: 200,
                body: {
                    id_usuario: 1,
                    nome: 'Bruno',
                    email: 'teste@email.com',
                    cpf: '123'
                }
            }
        ).as('perfil');

        cy.intercept(
            'PUT',
            '**/users/1',
            {
                statusCode: 200,
                body: {
                    message: 'ok'
                }
            }
        ).as('editar');

        cy.visit('/cliente');

        cy.wait('@perfil');

        cy.get('[data-cy="nome-perfil"]')
            .clear()
            .type('Bruno Novo');

        cy.get('[data-cy="salvar-perfil"]')
            .should('not.be.disabled')
            .click();

        cy.wait('@editar')
            .its('response.statusCode')
            .should('eq', 200);

        cy.get('[data-cy="success-message"]')
            .should('be.visible');
    });

    it('não deve salvar nome inválido', () => {

        cy.intercept(
            'GET',
            '**/users/1',
            {
                statusCode: 200,
                body: {
                    id_usuario: 1,
                    nome: 'Bruno',
                    email: 'teste@email.com',
                    cpf: '123'
                }
            }
        ).as('perfil');

        cy.visit('/cliente');

        cy.wait('@perfil');

        cy.get('[data-cy="nome-perfil"]')
            .clear()
            .type('A');

        cy.get('[data-cy="salvar-perfil"]')
            .should('not.be.disabled')
            .click();

        cy.get('[data-cy="error-message"]')
            .should('be.visible')
            .and('contain', '3 caracteres');
    });

});