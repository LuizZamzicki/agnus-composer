describe('Login', () => {

    beforeEach(() => {
        cy.visit('/login');
    });

    it('não deve enviar login vazio', () => {

        cy.visit('/login');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.url()
            .should('include', '/login');
    });

    it('deve limpar erro ao digitar novamente', () => {

        cy.intercept(
            'POST',
            '**/auth/login',
            {
                statusCode: 401,
                body: {
                    message: "Erro"
                }
            }
        ).as('erro');

        cy.visit('/login');

        cy.get('[data-cy=email]')
            .type('teste@email.com');

        cy.get('[data-cy=password]')
            .type('123');

        cy.get('[data-cy=submit-login]')
            .click();

        cy.wait('@erro');

        cy.get('[data-cy=error]')
            .should('exist');


        cy.get('[data-cy=password]')
            .type('456');


        cy.get('[data-cy=error]')
            .should('not.exist');
    });

    it('deve fazer login com sucesso', () => {

        cy.intercept(
            'POST',
            '**/auth/login',
            {
                statusCode: 200,
                body: {
                    token: 'fake-token',
                    tipo: 'usuario'
                }
            }
        ).as('login');

        cy.get('[data-cy="email"]')
            .type('teste@email.com');

        cy.get('[data-cy="password"]')
            .type('123456');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@login');

        cy.url()
            .should('not.include', '/login');
    });

    it('deve falhar login inválido', () => {

        cy.intercept(
            'POST',
            '**/auth/login',
            {
                statusCode: 401,
                body: {
                    message: 'Credenciais inválidas.'
                }
            }
        ).as('loginFail');

        cy.get('[data-cy="email"]')
            .type('erro@email.com');

        cy.get('[data-cy="password"]')
            .type('senhaerrada');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@loginFail');

        cy.get('[data-cy="error"]')
            .should('contain', 'Credenciais inválidas');
    });

    it('deve abrir modo cadastro', () => {

        cy.contains('Criar conta')
            .click();

        cy.get('[data-cy="nome"]')
            .should('exist');

        cy.get('[data-cy="cpf"]')
            .should('exist');

        cy.get('[data-cy="confirm-password"]')
            .should('exist');
    });

    it('não deve cadastrar com CPF inválido', () => {

        cy.contains('Criar conta')
            .click();

        cy.get('[data-cy="nome"]')
            .type('Teste');

        cy.get('[data-cy="cpf"]')
            .type('11111111111');

        cy.get('[data-cy="email"]')
            .type('teste@email.com');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.get('[data-cy="error"]')
            .should('contain', 'CPF inválido');
    });

    it('deve mostrar força da senha no cadastro', () => {

        cy.visit('/login');

        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy=password]')
            .type('Abc12345');

        cy.get('.senha-forca-box')
            .should('exist');
    });

    it('deve mostrar erro quando API recusar cadastro', () => {

        cy.intercept(
            'POST',
            '**/users',
            {
                statusCode: 400,
                body: {
                    message: 'Email já cadastrado'
                }
            }
        ).as('cadastroErro');

        cy.visit('/login');

        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy=nome]')
            .type('Teste');

        cy.get('[data-cy=cpf]')
            .type('52998224725');

        cy.get('[data-cy=email]')
            .type('teste@email.com');

        cy.get('[data-cy=password]')
            .type('Senha@123');

        cy.get('[data-cy=confirm-password]')
            .type('Senha@123');

        cy.get('[data-cy=submit-login]')
            .click();

        cy.wait('@cadastroErro');

        cy.get('[data-cy=error]')
            .should('contain', 'Email já cadastrado');
    });

    it('não deve cadastrar com email inválido', () => {

        cy.visit('/login');

        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy="nome"]')
            .type('Teste');

        cy.get('[data-cy="cpf"]')
            .type('52998224725');

        cy.get('[data-cy="email"]')
            .type('teste@teste');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.get('[data-cy="error"]')
            .should('be.visible')
            .and('contain', 'Email inválido');
    });

    it('deve iniciar login Google', () => {

        cy.visit('/login');

        cy.window()
            .then((win) => {
                cy.stub(win.location, 'href')
                    .as('google');
            });

        cy.get('.google-btn')
            .click();
    });

    it('não deve cadastrar com senhas diferentes', () => {

        cy.contains('Criar conta')
            .click();

        cy.get('[data-cy="nome"]')
            .type('Teste');

        cy.get('[data-cy="cpf"]')
            .type('52998224725');

        cy.get('[data-cy="email"]')
            .type('teste@email.com');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('OutraSenha@123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.get('[data-cy="error"]')
            .should('contain', 'As senhas não coincidem');
    });

    it('não deve cadastrar senha fraca', () => {

        cy.contains('Criar conta')
            .click();

        cy.get('[data-cy="nome"]')
            .type('Teste');

        cy.get('[data-cy="cpf"]')
            .type('52998224725');

        cy.get('[data-cy="email"]')
            .type('teste@email.com');

        cy.get('[data-cy="password"]')
            .type('123');

        cy.get('[data-cy="confirm-password"]')
            .type('123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.get('[data-cy="error"]')
            .should('contain', 'A senha não atende os requisitos mínimos');
    });

    it('deve cadastrar usuário com sucesso', () => {

        cy.intercept(
            'POST',
            '**/users',
            {
                statusCode: 200,
                body: {
                    id_usuario: 10
                }
            }
        ).as('cadastro');

        cy.visit('/login');


        cy.contains('CADASTRO')
            .click();

        cy.get('[data-cy="nome"]')
            .type('Bruno Teste');

        cy.get('[data-cy="cpf"]')
            .type('52998224725');

        cy.get('[data-cy="email"]')
            .type('bruno@email.com');

        cy.get('[data-cy="password"]')
            .type('Senha@123');

        cy.get('[data-cy="confirm-password"]')
            .type('Senha@123');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@cadastro');

        cy.get('.success-message')
            .should('be.visible')
            .and(
                'contain',
                'Cadastro realizado com sucesso!'
            );
    });

    it('deve mostrar e esconder senha', () => {

        cy.get('[data-cy="password"]')
            .type('123456');

        cy.get('.password-toggle')
            .first()
            .click();

        cy.get('[data-cy="password"]')
            .should('have.attr', 'type', 'text');
    });

    it('deve salvar token ao logar', () => {

        cy.intercept(
            'POST',
            '**/auth/login',
            {
                statusCode: 200,
                body: {
                    token: 'abc123',
                    tipo: 'usuario'
                }
            }
        ).as('login');

        cy.get('[data-cy="email"]')
            .type('teste@email.com');

        cy.get('[data-cy="password"]')
            .type('123456');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@login');

        cy.window()
            .then(win => {
                expect(
                    win.localStorage.getItem('auth_token')
                )
                    .eq('abc123');
            });
    });

    it('deve redirecionar administrador para /admin', () => {

        cy.intercept(
            'POST',
            '**/auth/login',
            {
                statusCode: 200,
                body: {
                    token: 'admin-token',
                    tipo: 'administrador'
                }
            }
        ).as('adminLogin');

        cy.get('[data-cy="email"]')
            .type('admin@email.com');

        cy.get('[data-cy="password"]')
            .type('123456');

        cy.get('[data-cy="submit-login"]')
            .click();

        cy.wait('@adminLogin');

        cy.url()
            .should('include', '/admin');
    });

    it('deve voltar para home', () => {

        cy.visit('/login');

        cy.contains('← Voltar')
            .click();

        cy.url()
            .should('eq', Cypress.config().baseUrl + '/');
    });
});