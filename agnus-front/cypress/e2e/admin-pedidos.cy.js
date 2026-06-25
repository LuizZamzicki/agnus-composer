describe("Menu Admin Pedidos", () => {

    beforeEach(() => {

        const token = "fake-admin-token";

        cy.intercept("POST", "**/api/auth/login", {
            statusCode: 200,
            body: {
                token,
                user: {
                    id_usuario: 1,
                    nome: "Administrador",
                    email: "admin@email.com",
                    tipo: "administrador"
                }
            }
        })
            .as("login");

        cy.intercept("GET", "**/api/orders*", {

            statusCode: 200,
            body: {
                data: [
                    {
                        id_pedido: 1,
                        cliente_nome: "Cliente Teste Cypress",
                        status: "pago",
                        valor_total: 150,
                        data_criacao: "2026-06-22"
                    }
                ],

                pagination: {
                    page: 1,
                    totalPages: 1,
                    total: 1,
                    hasNextPage: false,
                    hasPreviousPage: false
                }
            }
        })
            .as("pedidos");

        cy.intercept("PUT", "**/api/orders/*", {
            statusCode: 200,
            body: {
                message: "Pedido atualizado"
            }
        })
            .as("editarPedido");

        cy.visit("/login");

        cy.get('input[type="email"]')
            .type("admin@email.com");

        cy.get('input[type="password"]')
            .type("12345678");

        cy.get('button[type="submit"]')
            .click();

        cy.wait("@login");

        cy.visit("/admin/pedidos");

        cy.wait("@pedidos");
    });

    it("deve abrir lista de pedidos", () => {

        cy.get('[data-cy="tabela-pedidos"]')
            .should("exist");
    });

    it("deve mostrar dados do pedido", () => {

        cy.get('[data-cy="pedido-row"]')
            .should("contain", "Cliente Teste Cypress")
            .and("contain", "R$");
    });

    it("deve buscar pedido pelo cliente", () => {

        cy.get('[data-cy="buscar-pedido"]')
            .type("Cliente Teste");

        cy.get('[data-cy="pedido-row"]')
            .should("exist");
    });

    it("deve mostrar mensagem quando busca não encontrar", () => {

        cy.get('[data-cy="buscar-pedido"]')
            .type("Cliente inexistente");

        cy.contains("Nenhum pedido encontrado para os filtros informados")
            .should("exist");
    });

    it("deve filtrar por status", () => {

        cy.get('[data-cy="filtro-status-pedido"]')
            .select("pago");

        cy.get('[data-cy="pedido-row"]')
            .should("exist");
    });

    it("deve abrir edição de pedido", () => {

        cy.get('[data-cy="editar-pedido"]')
            .click();

        cy.get('[data-cy="novo-status-pedido"]')
            .should("exist");
    });

    it("deve cancelar edição de status", () => {

        cy.get('[data-cy="editar-pedido"]')
            .click();

        cy.get('[data-cy="cancelar-status-pedido"]')
            .click();

        cy.get('[data-cy="novo-status-pedido"]')
            .should("not.exist");
    });

    it("deve alterar status do pedido", () => {

        cy.get('[data-cy="editar-pedido"]')
            .click();

        cy.get('[data-cy="novo-status-pedido"]')
            .select("enviado");

        cy.get('[data-cy="salvar-status-pedido"]')
            .click();

        cy.wait("@editarPedido");

        cy.get('[data-cy="pedido-row"]')
            .should("contain", "Enviado");
    });

    it("deve mostrar loading enquanto carrega pedidos", () => {

        cy.intercept(
            "GET",
            "**/api/orders*",
            (req) => {

                req.on(
                    "response",
                    res => {
                        res.setDelay(2000);
                    }
                );
            }
        )
            .as("pedidoLento");

        cy.reload();

        cy.contains("Carregando pedidos...").should("exist");
    });

    it("deve mostrar erro quando API falhar", () => {

        cy.intercept(
            "GET",
            "**/api/orders*",
            {
                statusCode: 500
            }
        )
            .as("erroPedidos");

        cy.reload();

        cy.wait("@erroPedidos");

        cy.contains("Erro ao carregar pedidos").should("exist");
    });

    it("deve mostrar vazio quando não houver pedidos", () => {

        cy.intercept(
            "GET",
            "**/api/orders*",
            {
                statusCode: 200,
                body: {
                    data: []
                }
            }
        )
            .as("semPedidos");

        cy.reload();

        cy.wait("@semPedidos");

        cy.contains("Nenhum pedido encontrado").should("exist");
    });
});