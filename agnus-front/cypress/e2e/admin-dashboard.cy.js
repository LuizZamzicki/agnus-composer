describe("Dashboard Admin", () => {

    beforeEach(() => {

        cy.clearLocalStorage();

        // 🔐 AUTH consistente com seu sistema (igual ao teste de usuários)
        cy.visit("/admin/dashboard", {
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

        cy.intercept("GET", "**/users*", {
            statusCode: 200,
            body: {
                data: [
                    {
                        id_usuario: 1,
                        nome: "Bruno",
                        created_at: new Date().toISOString()
                    }
                ],
                pagination: {
                    total: 25
                }
            }
        }).as("users");

        cy.intercept("GET", "**/products*", {
            statusCode: 200,
            body: {
                data: [
                    {
                        id: 1,
                        nome: "Camisa",
                        created_at: new Date().toISOString()
                    }
                ],
                pagination: {
                    total: 150
                }
            }
        }).as("products");

        cy.intercept("GET", "**/categories*", {
            statusCode: 200,
            body: {
                data: [
                    {
                        id: 1,
                        nome: "Roupas",
                        created_at: new Date().toISOString()
                    }
                ],
                pagination: {
                    total: 8
                }
            }
        }).as("categories");

        cy.intercept("GET", "**/orders*", {
            statusCode: 200,
            body: []
        }).as("orders");
    });

    it("deve carregar dashboard", () => {

        cy.get("body", { timeout: 15000 }).should("be.visible");

        cy.get('[data-cy="dashboard-title"]', { timeout: 15000 })
            .should("exist")
            .and("contain.text", "Ultimas Acoes");
    });

    it("deve exibir cards de estatísticas", () => {

        cy.get('[data-cy="dashboard-card"]', { timeout: 15000 })
            .should("have.length", 5);
    });

    it("deve carregar dados do dashboard", () => {

        cy.get(".admin-dashboard-home")
            .should("exist");

        cy.get('[data-cy="dashboard-card"]')
            .should("exist");

    });

    it("deve mostrar estatísticas corretas", () => {


        cy.get('[data-cy="dashboard-card"]')
            .eq(0)
            .should("contain.text", "25");


        cy.get('[data-cy="dashboard-card"]')
            .eq(1)
            .should("contain.text", "150");


        cy.get('[data-cy="dashboard-card"]')
            .eq(2)
            .should("contain.text", "8");


    });

    it("deve mostrar atividades recentes", () => {


        cy.get('[data-cy="atividade-item"]')
            .should("exist");


    });

    it("deve mostrar erro quando API falhar", () => {


        cy.intercept(
            "GET",
            "**/users*",
            {
                statusCode: 500,
                body: {
                    message: "Erro servidor"
                }
            }
        );


        cy.visit("/admin/dashboard");


        cy.contains(
            "Erro servidor"
        )
            .should("exist");


    });

});