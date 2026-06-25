describe("Carrinho", () => {

    beforeEach(() => {

        localStorage.setItem(
            "auth_token",
            "fake-token"
        );

        localStorage.setItem(
            "auth",
            JSON.stringify({
                id_usuario: 1
            })
        );
    });

    function mockCarrinho() {

        cy.intercept(
            "GET",
            "**/carts?id_usuario=1",
            {
                body: [
                    {
                        id_carrinho: 1
                    }
                ]
            }
        ).as("carrinho");

        cy.intercept(
            "GET",
            "**/cart-items/1",
            {
                body: [
                    {
                        id_carrinho_item: 10,
                        quantidade: 2,
                        preco_unitario: 100,
                        produto: {
                            nome: "Camisa"
                        },
                        cor: {
                            nome: "Preto"
                        },
                        grade: {
                            nome: "M"
                        }
                    }
                ]
            }
        ).as("itens");
    }

    it("deve carregar carrinho", () => {

        mockCarrinho();

        cy.visit("/carrinho");

        cy.contains("Camisa")
            .should("exist");

        cy.contains("Preto")
            .should("exist");

        cy.contains("Tam: M")
            .should("exist");
    });

    it("deve aumentar quantidade", () => {
        mockCarrinho();

        cy.intercept(
            "PUT",
            "**/cart-items/10",
            {
                statusCode: 200
            }
        )
            .as("update");

        cy.visit("/carrinho");

        cy.get('[data-cy="aumentar-10"]')
            .click();

        cy.wait("@update");

        cy.get('[data-cy="quantidade-10"]')
            .should(
                "contain",
                "3"
            );
    });

    it("deve diminuir quantidade", () => {

        mockCarrinho();

        cy.intercept(
            "PUT",
            "**/cart-items/10",
            {
                statusCode: 200
            }
        )
            .as("updateQtd");

        cy.visit("/carrinho");

        cy.get('[data-cy="diminuir-10"]')
            .click();

        cy.wait("@updateQtd");

        cy.get('[data-cy="quantidade-10"]')
            .should(
                "contain",
                "1"
            );
    });

    it("deve selecionar produto", () => {

        mockCarrinho();

        cy.visit("/carrinho");

        cy.get('[data-cy="selecionar-item-10"]')
            .check();

        cy.get('[data-cy="selecionar-item-10"]')
            .should("be.checked");
    });

    it("deve selecionar todos produtos", () => {

        mockCarrinho();

        cy.visit("/carrinho");

        cy.get('[data-cy="selecionar-todos"]')
            .check();

        cy.get('[data-cy="selecionar-item-10"]')
            .should("be.checked");
    });

    it("deve calcular subtotal", () => {

        mockCarrinho();

        cy.visit("/carrinho");

        cy.get('[data-cy="selecionar-item-10"]')
            .check();

        cy.contains("R$ 200,00").should("exist");
    });

    it("deve cancelar remoção", () => {

        mockCarrinho();

        cy.visit("/carrinho");

        cy.get('[data-cy="remover-10"]')
            .click();

        cy.get('[data-cy="cancelar-remover"]')
            .click();

        cy.get('[data-cy="confirmar-remover"]')
            .should(
                "not.exist"
            );
    });

    it("deve remover produto", () => {

        mockCarrinho();

        cy.intercept(
            "DELETE",
            "**/cart-items/10",
            {
                statusCode: 200,
                body: {
                    message: "Produto removido com sucesso"
                }
            }
        )
            .as("delete");

        cy.visit("/carrinho");

        cy.get('[data-cy="remover-10"]')
            .click();

        cy.get('[data-cy="confirmar-remover"]')
            .click();

        cy.wait("@delete");

        cy.contains("SEU CARRINHO ESTÁ VAZIO").should("exist");
    });

    it("deve mostrar erro ao falhar remoção", () => {

        mockCarrinho();

        cy.intercept(
            "DELETE",
            "**/cart-items/10",
            {
                statusCode: 500,
                body: {
                    message: "Erro ao remover produto"
                }
            }
        )
            .as("erroDelete");

        cy.visit("/carrinho");

        cy.get('[data-cy="remover-10"]')
            .click();

        cy.get('[data-cy="confirmar-remover"]')
            .click();

        cy.wait("@erroDelete");

        cy.contains("Erro ao remover produto").should("exist");
    });

    it("não permite quantidade menor que 1", () => {

        cy.intercept(
            "GET",
            "**/carts?id_usuario=1",
            {
                body: [
                    {
                        id_carrinho: 1
                    }
                ]
            }
        );

        cy.intercept(
            "GET",
            "**/cart-items/1",
            {
                body: [
                    {
                        id_carrinho_item: 10,
                        quantidade: 1,
                        preco_unitario: 100,
                        produto: {
                            nome: "Camisa"
                        }
                    }
                ]
            }
        );

        cy.visit("/carrinho");

        cy.get('[data-cy="diminuir-10"]')
            .click();

        cy.get('[data-cy="quantidade-10"]')
            .should(
                "contain",
                "1"
            );
    });

    it("deve mostrar preço do produto", () => {

        mockCarrinho();

        cy.visit("/carrinho");

        cy.contains("R$ 200,00").should("exist");
    });

    it("deve calcular vários produtos selecionados", () => {

        cy.intercept(
            "GET",
            "**/carts?id_usuario=1",
            {
                body: [
                    {
                        id_carrinho: 1
                    }
                ]
            }
        );

        cy.intercept(
            "GET",
            "**/cart-items/1",
            {
                body: [
                    {
                        id_carrinho_item: 10,
                        quantidade: 1,
                        preco_unitario: 100,
                        produto: {
                            nome: "Camisa"
                        }
                    },
                    {
                        id_carrinho_item: 11,
                        quantidade: 2,
                        preco_unitario: 50,
                        produto: {
                            nome: "Calça"
                        }
                    }
                ]
            }
        );

        cy.visit("/carrinho");

        cy.get('[data-cy="selecionar-todos"]')
            .check();

        cy.contains("R$ 200,00").should("exist");
    });

    it("deve mostrar carrinho vazio", () => {
        cy.intercept(
            "GET",
            "**/carts?id_usuario=1",
            {
                body: []
            }
        );

        cy.visit("/carrinho");

        cy.contains("SEU CARRINHO ESTÁ VAZIO").should("exist");
    });

    it("não deve acessar sem login", () => {
        localStorage.clear();

        cy.visit("/carrinho");

        cy.contains("VOCÊ PRECISA ESTAR LOGADO").should("exist");
    });

    it("admin não possui carrinho", () => {
        localStorage.setItem(
            "auth",
            JSON.stringify({
                id_usuario: 1,
                tipo: "administrador"
            })
        );

        cy.visit("/carrinho");

        cy.contains("ADMINISTRADORES NÃO POSSUEM CARRINHO").should("exist");
    });
});