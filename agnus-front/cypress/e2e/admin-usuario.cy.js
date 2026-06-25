describe("Admin - Usuários", () => {

    beforeEach(() => {
        cy.clearLocalStorage();

        cy.intercept("GET", "**/api/users*", {
            statusCode: 200,
            body: {
                data: [
                    {
                        id_usuario: 1,
                        nome: "João Teste",
                        email: "joao@email.com",
                        tipo: "cliente"
                    },
                    {
                        id_usuario: 2,
                        nome: "Admin",
                        email: "admin@email.com",
                        tipo: "administrador"
                    }
                ],
                pagination: {
                    page: 1,
                    totalPages: 1,
                    total: 2,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            }
        }).as("usuarios");

        cy.intercept("GET", "**/api/products*", {
            statusCode: 200,
            body: {
                data: [],
                pagination: { page: 1, totalPages: 1, total: 0 }
            }
        }).as("getProducts");

        cy.visit("/admin/usuarios", {
            onBeforeLoad(win) {
                win.localStorage.setItem("auth_token", "fake-admin");
                win.localStorage.setItem("auth", JSON.stringify({
                    user: {
                        id_usuario: 1,
                        nome: "Administrador",
                        email: "admin@email.com",
                        tipo: "administrador"
                    }
                }));
            }
        });

        cy.wait("@usuarios", { timeout: 10000 });

        cy.get('[data-cy="usuario-tabela"]', { timeout: 10000 })
            .should("exist");
    });

    it("deve listar usuários", () => {
        cy.contains("João Teste")
            .should("exist");

        cy.contains("Admin")
            .should("exist");

        cy.get('tr')
            .should("have.length.greaterThan", 2);
    });

    it("deve buscar por nome", () => {
        cy.get('[data-cy="usuario-busca"]')
            .should("exist")
            .type("João");

        cy.contains("João Teste")
            .should("exist");
    });

    it("deve buscar por email", () => {
        cy.get('[data-cy="usuario-busca"]')
            .should("exist")
            .type("admin@email.com");

        cy.contains("Admin")
            .should("exist");
    });

    it("deve filtrar por tipo - cliente", () => {
        cy.get('[data-cy="usuario-filtro-tipo"]')
            .should("exist")
            .select("cliente");

        cy.get('[data-cy="usuario-tabela"]')
            .within(() => {
                cy.contains("João Teste").should("exist");
                cy.contains("Cliente").should("exist");
            });

        cy.get('[data-cy="usuario-tabela"]')
            .should("not.contain", "Administrador");
    });

    it("deve filtrar por tipo - administrador", () => {
        cy.get('[data-cy="usuario-filtro-tipo"]')
            .should("exist")
            .select("administrador");

        cy.contains("Admin")
            .should("exist");

        cy.contains("João Teste")
            .should("not.exist");
    });

    it("deve mostrar loading ao carregar usuários", () => {

        cy.intercept(
            "GET",
            "**/api/users*",
            (req) => {

                req.on(
                    "response",
                    res => {
                        res.setDelay(2000);
                    }
                );
            }
        )
            .as("usuariosLentos");

        cy.reload();

        cy.contains("Carregando usuarios...").should("exist");
    });

    it("deve buscar usuário pelo ID", () => {

        cy.get('[data-cy="usuario-busca"]')
            .type("1");

        cy.get('[data-cy="usuario-tabela"]')
            .within(() => {

                cy.contains("João Teste")
                    .should("exist");
            });
    });

    it("não deve mostrar usuário que não corresponde a busca", () => {

        cy.get('[data-cy="usuario-busca"]')
            .type("Maria");

        cy.contains("João Teste")
            .should("not.exist");
    });

    it("deve limpar busca e mostrar todos novamente", () => {

        cy.get('[data-cy="usuario-busca"]')
            .type("João");

        cy.get('[data-cy="usuario-busca"]')
            .clear();

        cy.contains("João Teste")
            .should("exist");
    });

    it("deve mostrar erro quando API falhar", () => {

        cy.intercept(
            "GET",
            "**/api/users*",
            {
                statusCode: 500,
                body: {
                    message: "Erro servidor"
                }
            }
        )
            .as("erroUsuarios");

        cy.reload();

        cy.wait("@erroUsuarios");

        cy.contains("Erro servidor").should("exist");
    });

    it("deve mostrar mensagem quando não existir usuários", () => {

        cy.intercept(
            "GET",
            "**/api/users*",
            {
                statusCode: 200,
                body: {
                    data: [],
                    pagination: {
                        page: 1,
                        totalPages: 1,
                        total: 0
                    }
                }
            }
        )
            .as("semUsuarios");

        cy.reload();

        cy.wait("@semUsuarios");

        cy.contains("Nenhum usuario encontrado").should("exist");
    });

    it("deve ir para próxima página", () => {

        cy.intercept(
            "GET",
            "**/api/users*",
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_usuario: 3,
                            nome: "Usuario Pagina 2",
                            email: "pagina2@email.com",
                            tipo: "cliente"
                        }
                    ],

                    pagination: {
                        page: 2,
                        totalPages: 2,
                        total: 3,
                        hasNextPage: false,
                        hasPreviousPage: true
                    }
                }
            }
        )
            .as("pagina2");

        cy.intercept(
            "GET",
            "**/api/users?page=1*",
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_usuario: 1,
                            nome: "João Teste",
                            email: "joao@email.com",
                            tipo: "cliente"
                        }
                    ],

                    pagination: {
                        page: 1,
                        totalPages: 2,
                        total: 3,
                        hasNextPage: true,
                        hasPreviousPage: false
                    }
                }
            }
        )
            .as("primeiraPagina");

        cy.reload();

        cy.wait("@primeiraPagina");

        cy.get('[data-cy="usuario-proxima"]')
            .should("not.be.disabled")
            .click();

        cy.wait("@pagina2");

        cy.contains("Usuario Pagina 2").should("exist");
    });

    it("deve formatar tipo corretamente", () => {

        cy.get('[data-cy="usuario-tipo"]')
            .first()
            .should(
                "contain",
                "Cliente"
            );
    });

    it("deve validar estrutura da tabela", () => {

        cy.get('[data-cy="usuario-tabela"]')
            .within(() => {

                cy.contains("ID")
                    .should("exist");

                cy.contains("Nome")
                    .should("exist");

                cy.contains("Email")
                    .should("exist");

                cy.contains("Tipo")
                    .should("exist");
            });
    });

    it("deve alterar quantidade por página", () => {
        cy.get('[data-cy="usuario-limit"]')
            .should("exist")
            .select("20");

        cy.get('[data-cy="usuario-limit"]')
            .should("have.value", "20");
    });

    it("deve alterar quantidade para 30 por página", () => {
        cy.get('[data-cy="usuario-limit"]')
            .should("exist")
            .select("30");

        cy.get('[data-cy="usuario-limit"]')
            .should("have.value", "30");
    });

    it("deve desabilitar botão anterior na primeira página", () => {
        cy.get('[data-cy="usuario-anterior"]')
            .should("be.disabled");
    });

    it("deve desabilitar botão próxima quando não há próxima página", () => {
        cy.get('[data-cy="usuario-proxima"]')
            .should("be.disabled");
    });

    it("deve exibir informações de paginação", () => {
        cy.get('[data-cy="usuario-paginacao"]')
            .should("exist");

        cy.contains("Pagina 1 de 1")
            .should("exist");

        cy.contains("2 usuario(s) no total")
            .should("exist");
    });

    it("deve exibir campos de filtro e busca", () => {
        cy.get('[data-cy="usuario-busca"]')
            .should("exist")
            .should("have.attr", "placeholder", "Buscar por ID, nome, email ou tipo");

        cy.get('[data-cy="usuario-filtro-tipo"]').should("exist");
        cy.get('[data-cy="usuario-limit"]').should("exist");
    });

});