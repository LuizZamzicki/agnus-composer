describe('CRUD endereços', () => {

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


    it('deve cadastrar endereço', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: []
            }
        ).as('getEnderecos');


        cy.intercept(
            'POST',
            '**/user-addresses',
            {
                statusCode: 200,
                body: {
                    id_usuario_endereco: 10
                }
            }
        ).as('saveEndereco');


        cy.visit('/cliente/enderecos');


        cy.wait('@getEnderecos');


        cy.get('[data-cy="novo-endereco"]')
            .should('exist')
            .click({ force: true });



        cy.get('[data-cy="cep"]')
            .type('87000000');


        cy.get('[data-cy="logradouro"]')
            .type('Rua Teste');


        cy.get('[data-cy="numero"]')
            .type('100');


        cy.get('[data-cy="bairro"]')
            .type('Centro');


        cy.get('[data-cy="cidade"]')
            .type('Maringá');


        cy.get('[data-cy="estado"]')
            .select('PR');



        cy.get('[data-cy="salvar-endereco"]')
            .click({ force: true });



        cy.wait('@saveEndereco')
            .its('response.statusCode')
            .should('eq', 200);

    });

    it('deve editar endereço', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: [
                    {
                        id_usuario_endereco: 5,
                        cep: "87000000",
                        logradouro: "Rua A",
                        numero: "10",
                        bairro: "Centro",
                        cidade: "Maringá",
                        estado: "PR",
                        ativo: true
                    }
                ]
            }
        ).as('getEnderecos');


        cy.intercept(
            'PUT',
            '**/user-addresses/5',
            {
                statusCode: 200,
                body: {}
            }
        ).as('editarEndereco');


        cy.visit('/cliente/enderecos');


        cy.wait('@getEnderecos');


        cy.get('[data-cy="editar-endereco"]')
            .click({ force: true });


        cy.get('[data-cy="numero"]')
            .clear()
            .type('999');


        cy.get('[data-cy="salvar-endereco"]')
            .click({ force: true });


        cy.wait('@editarEndereco')
            .its('response.statusCode')
            .should('eq', 200);

    });

    it('não deve salvar endereço vazio', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: []
            }
        );


        cy.visit('/cliente/enderecos');


        cy.get('[data-cy="novo-endereco"]')
            .click({ force: true });


        cy.get('[data-cy="salvar-endereco"]')
            .click({ force: true });


        cy.get('.error-message')
            .should('contain', 'Preencha todos os campos obrigatórios.');

    });

    it('deve cancelar novo endereço', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: []
            }
        );


        cy.visit('/cliente/enderecos');


        cy.get('[data-cy="novo-endereco"]')
            .click({ force: true });


        cy.get('[data-cy="cancelar-endereco"]')
            .click({ force: true });


        cy.get('.modal')
            .should('not.exist');

    });

    it('deve cancelar exclusão', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: [
                    {
                        id_usuario_endereco: 5,
                        cep: "87000000",
                        logradouro: "Rua A",
                        numero: "10",
                        bairro: "Centro",
                        cidade: "Maringá",
                        estado: "PR",
                        ativo: true
                    }
                ]
            }
        );


        cy.visit('/cliente/enderecos');


        cy.get('[data-cy="excluir-endereco"]')
            .click({ force: true });


        cy.get('[data-cy="cancelar-excluir-endereco"]')
            .click({ force: true });


        cy.get('.modal.confirm')
            .should('not.exist');

    });

    it('deve definir endereço como principal', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: [
                    {
                        id_usuario_endereco: 5,
                        cep: "87000000",
                        logradouro: "Rua A",
                        numero: "10",
                        bairro: "Centro",
                        cidade: "Maringá",
                        estado: "PR",
                        principal: false,
                        ativo: true
                    }
                ]
            }
        );


        cy.intercept(
            'PUT',
            '**/user-addresses/5',
            {
                statusCode: 200,
                body: {}
            }
        ).as('principal');


        cy.visit('/cliente/enderecos');


        cy.get('[data-cy="endereco-card"]')
            .click({ force: true });


        cy.get('[data-cy="confirmar-definir-principal"]')
            .click({ force: true });


        cy.wait('@principal')
            .its('response.statusCode')
            .should('eq', 200);


    });

    it('mostra erro quando API falha ao salvar', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: []
            }
        );


        cy.intercept(
            'POST',
            '**/user-addresses',
            {
                statusCode: 500
            }
        );


        cy.visit('/cliente/enderecos');


        cy.get('[data-cy="novo-endereco"]')
            .click({ force: true });


        cy.get('[data-cy="cep"]').type('87000000');
        cy.get('[data-cy="logradouro"]').type('Rua Teste');
        cy.get('[data-cy="numero"]').type('10');
        cy.get('[data-cy="bairro"]').type('Centro');
        cy.get('[data-cy="cidade"]').type('Maringá');
        cy.get('[data-cy="estado"]').select('PR');


        cy.get('[data-cy="salvar-endereco"]')
            .click({ force: true });


        cy.get('.error-message')
            .should('exist');

    });

    it('deve formatar CEP no card', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: [
                    {
                        id_usuario_endereco: 1,
                        cep: "87000000",
                        logradouro: "Rua A",
                        numero: "1",
                        bairro: "Centro",
                        cidade: "Maringá",
                        estado: "PR",
                        ativo: true
                    }
                ]
            }
        );


        cy.visit('/cliente/enderecos');


        cy.contains('87000-000')
            .should('exist');

    });

    it('deve excluir endereço', () => {


        cy.intercept(
            'GET',
            '**/user-addresses/1',
            {
                body: [
                    {
                        id_usuario_endereco: 5,
                        cep: "87000000",
                        logradouro: "Rua A",
                        numero: "10",
                        bairro: "Centro",
                        cidade: "Maringá",
                        estado: "PR",
                        ativo: true
                    }
                ]
            }
        ).as('getEnderecos');



        cy.intercept(
            'DELETE',
            '**/user-addresses/5',
            {
                statusCode: 200
            }
        ).as('deleteEndereco');



        cy.visit('/cliente/enderecos');


        cy.wait('@getEnderecos');



        cy.get('[data-cy="excluir-endereco"]')
            .first()
            .click({ force: true });



        cy.get('.modal.confirm')
            .should('be.visible');



        cy.get('.modal.confirm .danger')
            .click({ force: true });



        cy.wait('@deleteEndereco')
            .its('response.statusCode')
            .should('eq', 200);


    });




});