describe("Dashboard Admin", () => {

    beforeEach(() => {

        cy.clearLocalStorage();

        // O painel fala só com o BFF, que agrega os dados dos demais serviços.
        cy.intercept("GET", "**/api/admin/dashboard*", {
            statusCode: 200,
            body: {
                totais: { usuarios: 25, produtos: 150, categorias: 8, pedidos: 0 },
                usuarios: [{ id_usuario: 1, nome: "Bruno", created_at: new Date().toISOString() }],
                produtos: [{ id: 1, nome: "Camisa", created_at: new Date().toISOString() }],
                categorias: [{ id: 1, nome: "Roupas", created_at: new Date().toISOString() }],
                pedidos: [],
                indisponiveis: []
            }
        }).as("dashboard");

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
    });

    it("deve carregar dashboard", () => {

        cy.get("body", { timeout: 15000 }).should("be.visible");

        cy.get('[data-cy="dashboard-title"]', { timeout: 15000 })
            .should("exist")
            .and("contain.text", "Ultimas Ações");
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
            "**/api/admin/dashboard*",
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