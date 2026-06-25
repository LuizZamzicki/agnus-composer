describe('Alterar senha', () => {

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

    it('deve alterar senha com sucesso', () => {

        cy.intercept(
            'PATCH',
            '**/users/1/password',
            {
                statusCode: 200,
                body: {
                    message: 'Senha alterada'
                }
            }
        ).as('alterarSenha');

        cy.visit('/cliente/senha');

        cy.get('[data-cy="senha-atual"]')
            .type('SenhaAtual123!');

        cy.get('[data-cy="nova-senha"]')
            .type('NovaSenha123!');

        cy.get('[data-cy="confirmar-senha"]')
            .type('NovaSenha123!');

        cy.get('[data-cy="alterar-senha"]')
            .click();

        cy.wait('@alterarSenha')
            .its('response.statusCode')
            .should('eq', 200);

        cy.get('[data-cy="toast"]')
            .should(
                'contain',
                'Senha alterada com sucesso'
            );
    });

    it('não deve permitir senhas diferentes', () => {
        cy.visit('/cliente/senha');

        cy.get('[data-cy="senha-atual"]')
            .type('SenhaAtual123!');

        cy.get('[data-cy="nova-senha"]')
            .type('NovaSenha123!');

        cy.get('[data-cy="confirmar-senha"]')
            .type('OutraSenha123!');

        cy.get('[data-cy="alterar-senha"]')
            .should('be.disabled');
    });

    it('não deve aceitar senha fraca', () => {
        cy.visit('/cliente/senha');

        cy.get('[data-cy="senha-atual"]')
            .type('SenhaAtual123!');

        cy.get('[data-cy="nova-senha"]')
            .type('123');

        cy.get('[data-cy="confirmar-senha"]')
            .type('123');

        cy.get('[data-cy="alterar-senha"]')
            .should('be.disabled');
    });

    it('não deve aceitar senha sem símbolo', () => {
        cy.visit('/cliente/senha');

        cy.get('[data-cy="senha-atual"]')
            .type('SenhaAtual123!');

        cy.get('[data-cy="nova-senha"]')
            .type('NovaSenha123');

        cy.get('[data-cy="confirmar-senha"]')
            .type('NovaSenha123');

        cy.get('[data-cy="alterar-senha"]')
            .should('be.disabled');
    });

    it('não deve permitir campos vazios', () => {
        cy.visit('/cliente/senha');

        cy.get('[data-cy="alterar-senha"]')
            .should('be.disabled');
    });

    it('deve mostrar erro quando API rejeitar senha', () => {

        cy.intercept(
            'PATCH',
            '**/users/1/password',
            {
                statusCode: 400,
                body: {
                    message: 'Senha atual incorreta'
                }
            }
        ).as('erroSenha');

        cy.visit('/cliente/senha');

        cy.get('[data-cy="senha-atual"]')
            .type('SenhaErrada123!');

        cy.get('[data-cy="nova-senha"]')
            .type('NovaSenha123!');

        cy.get('[data-cy="confirmar-senha"]')
            .type('NovaSenha123!');

        cy.get('[data-cy="alterar-senha"]')
            .click();

        cy.wait('@erroSenha');

        cy.get('[data-cy="toast"]')
            .should(
                'contain',
                'Senha atual incorreta'
            );
    });

    it('deve exibir força da senha', () => {
        cy.visit('/cliente/senha');

        cy.get('[data-cy="nova-senha"]')
            .type('NovaSenha123!');

        cy.get('[data-cy="forca-senha"]')
            .should('exist');
    });
});