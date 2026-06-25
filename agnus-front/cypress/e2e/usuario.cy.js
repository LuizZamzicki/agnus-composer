describe('Login e Cadastro', () => {

    beforeEach(() => {
        cy.visit('/login');
    });


    it('deve abrir tela de cadastro', () => {

        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy="nome"]')
            .should('exist');

        cy.get('[data-cy="cpf"]')
            .should('exist');

        cy.get('[data-cy="confirm-password"]')
            .should('exist');

    });


    it('deve trocar para cadastro pelo link inferior', () => {

        cy.contains('Criar conta')
            .click();

        cy.get('[data-cy="nome"]')
            .should('exist');

    });


    it('não deve enviar cadastro sem preencher campos', () => {

        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.get('[data-cy="nome"]')
            .should('have.prop', 'required');

    });


    it('cadastra usuário com sucesso', () => {

        cy.intercept(
            'POST',
            '**/users',
            {
                statusCode: 200,
                body: {
                    message: 'Cadastro realizado'
                }
            }
        ).as('cadastro');


        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="nome"]')
            .type('Bruno Teste');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="cpf"]')
            .type('12345678909');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');


        cy.get('[data-cy="submit-login"]')
            .click();


        cy.wait('@cadastro');


        cy.contains('Cadastro realizado com sucesso')
            .should('exist');

    });


    it('não deve cadastrar CPF inválido', () => {

        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="nome"]')
            .type('Bruno');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="cpf"]')
            .type('11111111111');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');


        cy.get('[data-cy="submit-login"]')
            .click();


        cy.get('[data-cy="error"]')
            .should('contain', 'CPF inválido');

    });


    it('não deve cadastrar email inválido', () => {

        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="email"]')
            .type('emailerrado');

        cy.get('[data-cy="email"]')
            .blur();


        cy.get('[data-cy="email"]')
            .should('have.prop', 'validationMessage')
            .and('not.be.empty');

    });


    it('não deve cadastrar senha diferente', () => {

        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="nome"]')
            .type('Bruno');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="cpf"]')
            .type('12345678909');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@456');


        cy.get('[data-cy="submit-login"]')
            .click();


        cy.get('[data-cy="error"]')
            .should('contain', 'senhas não coincidem');

    });


    it('não deve aceitar senha fraca', () => {

        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="nome"]')
            .type('Bruno');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="cpf"]')
            .type('12345678909');

        cy.get('[data-cy="password"]')
            .type('123');

        cy.get('[data-cy="confirm-password"]')
            .type('123');


        cy.get('[data-cy="submit-login"]')
            .click();


        cy.get('[data-cy="error"]')
            .should('contain', 'senha não atende');

    });


    it('deve mostrar erro quando API falhar', () => {

        cy.intercept(
            'POST',
            '**/users',
            {
                statusCode: 400,
                body: {
                    message: 'Email já cadastrado'
                }
            }
        ).as('erroCadastro');


        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="nome"]')
            .type('Bruno');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="cpf"]')
            .type('12345678909');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');


        cy.get('[data-cy="submit-login"]')
            .click();


        cy.wait('@erroCadastro');


        cy.get('[data-cy="error"]')
            .should('contain', 'Email já cadastrado');

    });


    it('deve formatar CPF enquanto digita', () => {

        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="cpf"]')
            .type('12345678909');


        cy.get('[data-cy="cpf"]')
            .should(
                'have.value',
                '123.456.789-09'
            );

    });


    it('deve mostrar indicador de força da senha', () => {

        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="password"]')
            .type('Senha@123');


        cy.get('.senha-forca-box')
            .should('exist');

    });


    it('deve mostrar e esconder senha', () => {

        cy.get('[data-cy="password"]')
            .type('Senha123');


        cy.get('.password-toggle')
            .click();


        cy.get('[data-cy="password"]')
            .should(
                'have.attr',
                'type',
                'text'
            );


        cy.get('.password-toggle')
            .click();


        cy.get('[data-cy="password"]')
            .should(
                'have.attr',
                'type',
                'password'
            );

    });


    it('deve mostrar e esconder confirmação de senha', () => {

        cy.contains('CADASTRO')
            .click();


        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');


        cy.get('.password-toggle')
            .last()
            .click();


        cy.get('[data-cy="confirm-password"]')
            .should(
                'have.attr',
                'type',
                'text'
            );
    });

    it('deve mostrar carregando durante cadastro', () => {

        cy.intercept(
            'POST',
            '**/users',
            {
                delay: 2000,
                statusCode: 200,
                body: {}
            }
        ).as('cadastro');

        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy="nome"]')
            .type('Bruno');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="cpf"]')
            .type('12345678909');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.get('[data-cy="submit-login"]')
            .should('contain', 'Carregando');
    });

    it('deve limpar erro ao digitar novamente', () => {

        cy.intercept(
            'POST',
            '**/users',
            {
                statusCode: 400,
                body: {
                    message: 'Erro cadastro'
                }
            }
        ).as('erro');

        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy="nome"]')
            .type('Bruno');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="cpf"]')
            .type('12345678909');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@erro');

        cy.get('[data-cy="error"]')
            .should('exist');

        cy.get('[data-cy="email"]')
            .clear()
            .type('novo@email.com');

        cy.get('[data-cy="error"]')
            .should('not.exist');
    });

    it('deve voltar para página inicial', () => {

        cy.get('.back-home-btn')
            .click();

        cy.url()
            .should('not.include', '/login');
    });

    it('deve fazer login com sucesso', () => {

        cy.intercept(
            'POST',
            '**/auth/login',
            {
                statusCode: 200,
                body: {
                    token: 'fake-token',
                    tipo: 'cliente',
                    id_usuario: 1
                }
            }
        ).as('login');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@login');

        cy.url()
            .should('not.include', 'login');
    });

    it('login inválido deve mostrar erro', () => {

        cy.intercept(
            'POST',
            '**/auth/login',
            {
                statusCode: 401,
                body: {
                    message: 'Credenciais inválidas'
                }
            }
        ).as('loginErro');

        cy.get('[data-cy="email"]')
            .type('teste@email.com');

        cy.get('[data-cy="password"]')
            .type('123456');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@loginErro');

        cy.get('[data-cy="error"]')
            .should('contain', 'Credenciais inválidas');

    });

    it('botão google deve redirecionar', () => {

        cy.window()
            .then((win) => {

                cy.stub(win.location, 'href')
                    .as('redirect');
            });

        cy.get('.google-btn')
            .click();
    })
});