describe("Painel Admin", () => {

    beforeEach(() => {

        cy.clearLocalStorage();

        cy.visit("/admin/produtos", {

            onBeforeLoad(win) {

                win.localStorage.setItem(
                    "auth_token",
                    "fake-admin"
                );

                win.localStorage.setItem(
                    "auth",
                    JSON.stringify({
                        user: {
                            id_usuario: 1,
                            nome: "Administrador",
                            email: "admin@email.com",
                            tipo: "administrador"
                        }
                    })
                );
            }
        });

        cy.get('[data-cy="admin-page"]')
            .should("exist");
    });

    it("deve abrir painel administrativo", () => {

        cy.get('[data-cy="admin-title"]')
            .should(
                "contain.text",
                "Produtos"
            );

        cy.get('[data-cy="admin-content"]')
            .should("exist");

    });

    it("deve possuir menu lateral", () => {

        cy.get(".admin-sidebar")
            .should("exist");
    });

    it("deve abrir dashboard corretamente", () => {

        cy.visit("/admin/dashboard");

        cy.get('[data-cy="admin-title"]')
            .should(
                "contain.text",
                "Dashboard"
            );
    });

    it("deve abrir usuários corretamente", () => {

        cy.intercept(
            "GET",
            "**/api/users*",
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_usuario: 1,
                            nome: "Usuario Teste",
                            email: "teste@email.com",
                            tipo: "cliente"
                        }
                    ],

                    pagination: {
                        page: 1,
                        limit: 10,
                        total: 1,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPreviousPage: false
                    }
                }
            }
        )
            .as("usuarios");

        cy.visit("/admin/usuarios");

        cy.wait("@usuarios");

        cy.get('[data-cy="admin-title"]')
            .should(
                "contain.text",
                "Usuarios"
            );

        cy.get('[data-cy="usuario-tabela"]')
            .should("exist");

        cy.contains("Usuario Teste")
            .should("exist");
    });

    it("deve abrir categorias corretamente", () => {

        cy.intercept(
            "GET",
            "**/api/categories*",
            {
                statusCode: 200,
                body: {
                    data: []
                }
            }
        );

        cy.visit("/admin/categorias");

        cy.get('[data-cy="admin-title"]')
            .should(
                "contain.text",
                "Categoria de Produtos"
            );
    });

    it("deve abrir pedidos corretamente", () => {

        cy.intercept(
            "GET",
            "**/api/orders*",
            {
                statusCode: 200,
                body: {
                    data: []
                }
            }
        );

        cy.visit("/admin/pedidos");

        cy.get('[data-cy="admin-title"]')
            .should(
                "contain.text",
                "Pedidos"
            );
    });

    it("deve acessar cadastro de produto", () => {

        cy.visit("/admin/produtos/cadastrar");

        cy.get('[data-cy="admin-title"]')
            .should(
                "contain.text",
                "Produtos"
            );

    });

    it("deve acessar edição de produto", () => {

        cy.visit("/admin/produtos/editar/1");

        cy.get('[data-cy="admin-title"]')
            .should(
                "contain.text",
                "Produtos"
            );
    });

    it("deve redirecionar /admin para produtos", () => {

        cy.visit("/admin");

        cy.location("pathname")
            .should(
                "eq",
                "/admin/produtos"
            );
    });

    it("deve redirecionar rota inexistente", () => {

        cy.visit("/admin/teste");

        cy.location("pathname")
            .should(
                "eq",
                "/admin/produtos"
            );
    });

    it("não deve renderizar lista de produtos no cadastro", () => {

        cy.visit("/admin/produtos/cadastrar");

        cy.get('[data-cy="produto-tabela"]')
            .should(
                "not.exist"
            );
    });

    it("deve manter layout principal carregado", () => {

        cy.get('[data-cy="admin-page"]')
            .should("exist");

        cy.get('[data-cy="admin-content"]')
            .should("exist");

        cy.get(".admin-header")
            .should("exist");

    });
});