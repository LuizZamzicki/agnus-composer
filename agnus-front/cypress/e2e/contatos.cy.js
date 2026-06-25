describe('CRUD contatos', () => {

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

    it('cadastrar contato', () => {

        cy.intercept(
            'GET',
            '**/user-contacts/1',
            {
                statusCode: 200,
                body: []
            }
        ).as('getContatos');

        cy.intercept(
            'POST',
            '**/user-contacts',
            {
                statusCode: 200,
                body: {
                    id_usuario_contato: 10
                }
            }
        ).as('saveContato');

        cy.visit('/cliente/contatos');

        cy.wait('@getContatos');

        cy.get('[data-cy="novo-contato"]')
            .should('exist')
            .click({ force: true });

        cy.get('[data-cy="tipo-contato"]')
            .should('be.visible')
            .select('celular');

        cy.get('[data-cy="valor-contato"]')
            .should('be.visible')
            .type('44999999999');

        cy.get('[data-cy="salvar-contato"]')
            .click({ force: true });

        cy.wait('@saveContato')
            .its('response.statusCode')
            .should('eq', 200);

        // cy.get('[data-cy="contato-card"]')
        //     .should('exist');
    });

    it('editar contato', () => {

        cy.intercept(
            'GET',
            '**/user-contacts/1',
            {
                statusCode: 200,
                body: [
                    {
                        id_usuario_contato: 10,
                        tipo: 'celular',
                        valor: '44999999999',
                        principal: false
                    }
                ]
            }
        ).as('getContatos');

        cy.intercept(
            'PUT',
            '**/user-contacts/10',
            {
                statusCode: 200,
                body: {}
            }
        ).as('editarContato');

        cy.visit('/cliente/contatos');

        cy.wait('@getContatos');

        cy.get('[data-cy="editar-contato"]')
            .should('be.visible')
            .click({ force: true });

        cy.get('[data-cy="valor-contato"]')
            .should('be.visible')
            .clear()
            .type('44988888888');

        cy.get('[data-cy="salvar-contato"]')
            .click({ force: true });

        cy.wait('@editarContato')
            .its('response.statusCode')
            .should('eq', 200);
    });

    it('excluir contato', () => {

        cy.intercept(
            'GET',
            '**/user-contacts/1',
            {
                statusCode: 200,
                body: [
                    {
                        id_usuario_contato: 10,
                        tipo: 'celular',
                        valor: '44999999999',
                        principal: false
                    }
                ]
            }
        ).as('getContatos');

        cy.intercept(
            'DELETE',
            '**/user-contacts/10',
            {
                statusCode: 200,
                body: {}
            }
        ).as('deleteContato');

        cy.visit('/cliente/contatos');

        cy.wait('@getContatos');

        cy.get('[data-cy="excluir-contato"]')
            .should('exist')
            .click({ force: true });

        cy.get('[data-cy="confirmar-excluir-contato"]')
            .should('be.visible')
            .click({ force: true });

        cy.wait('@deleteContato')
            .its('response.statusCode')
            .should('eq', 200);

        cy.get('[data-cy="contato-card"]')
            .should('not.exist');
    });

    it('não deve salvar contato vazio', () => {

        cy.intercept(
            'GET',
            '**/user-contacts/1',
            {
                statusCode: 200,
                body: []
            }
        ).as('getContatos');

        cy.visit('/cliente/contatos');

        cy.wait('@getContatos');

        cy.get('[data-cy="novo-contato"]')
            .click({ force: true });

        cy.get('[data-cy="salvar-contato"]')
            .click({ force: true });

        cy.get('.error-message')
            .should('contain.text', 'Preencha o valor do contato.');
    });

    it('deve formatar celular automaticamente', () => {

        cy.intercept(
            'GET',
            '**/user-contacts/1',
            {
                statusCode: 200,
                body: []
            }
        ).as('getContatos');

        cy.visit('/cliente/contatos');

        cy.wait('@getContatos');

        cy.get('[data-cy="novo-contato"]')
            .click({ force: true });

        cy.get('[data-cy="valor-contato"]')
            .type('44999999999');

        cy.get('[data-cy="valor-contato"]')
            .should('have.value', '(44) 99999-9999');
    });

    it('deve marcar contato como principal', () => {

        cy.intercept(
            'GET',
            '**/user-contacts/1',
            {
                statusCode: 200,
                body: [
                    {
                        id_usuario_contato: 10,
                        tipo: 'celular',
                        valor: '44999999999',
                        principal: false
                    }
                ]
            }
        ).as('getContatos');

        cy.intercept(
            'PUT',
            '**/user-contacts/10',
            {
                statusCode: 200,
                body: {}
            }
        ).as('principal');

        cy.visit('/cliente/contatos');

        cy.wait('@getContatos');

        cy.get('[data-cy="contato-card"]')
            .click({ force: true });

        cy.contains('Confirmar')
            .click({ force: true });

        cy.wait('@principal');

        cy.get('.badge')
            .should('contain.text', 'Principal');
    });
});