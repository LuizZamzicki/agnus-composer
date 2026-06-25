describe("Admin - Produtos", () => {

    beforeEach(() => {

        cy.clearLocalStorage();

        cy.intercept(
            "POST",
            "**/api/auth/login",
            {
                statusCode: 200,
                body: {
                    token: "fake-admin-token",
                    user: {
                        id_usuario: 1,
                        nome: "Administrador",
                        email: "admin@email.com",
                        tipo: "administrador"
                    }
                }
            }
        )
            .as("login");

        cy.intercept(
            "GET",
            "**/api/products*",
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_produto: 1,
                            id_categoria: 1,
                            nome: "Produto teste",
                            preco_custo: "10.00",
                            preco_base: "20.00",
                            ativo: true
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
            .as("produtos");

        cy.intercept(
            "GET",
            "**/api/categories*",
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_categoria: 1,
                            nome: "Categoria teste"
                        }
                    ]
                }
            }
        )
            .as("categorias");

        cy.intercept(
            "DELETE",
            "**/api/products/*",
            {
                statusCode: 200,
                body: {
                    message: "Produto deletado com sucesso."
                }
            }
        )
            .as("deletarProduto");

        cy.visit("/login");

        cy.get('input[type="email"]')
            .type("admin@email.com");

        cy.get('input[type="password"]')
            .type("12345678");

        cy.get('button[type="submit"]')
            .click();

        cy.wait("@login");
        cy.visit("/admin/produtos");
        cy.wait("@produtos");
        cy.wait("@categorias");
    });

    it("deve mostrar loading enquanto carrega produtos", () => {

        cy.intercept(
            "GET",
            "**/api/products*",
            (req) => {

                req.on(
                    "response",
                    res => {
                        res.setDelay(2000);
                    }
                );

            }
        )
            .as("produtosLentos");

        cy.reload();

        cy.contains("Carregando produtos...").should("exist");
    });

    it("deve listar produtos corretamente na tabela", () => {

        cy.get('[data-cy="produto-tabela"]')
            .should("exist");

        cy.get('[data-cy="produto-nome"]')
            .should(
                "contain",
                "Produto teste"
            );

        cy.get('[data-cy="produto-categoria"]')
            .should(
                "contain",
                "Categoria teste"
            );

        cy.get('[data-cy="produto-custo"]')
            .should("exist");

        cy.get('[data-cy="produto-preco"]')
            .should("exist");
    });

    it("deve formatar valores monetários", () => {

        cy.get('[data-cy="produto-custo"]')
            .should(
                "contain",
                "R$"
            );

        cy.get('[data-cy="produto-preco"]')
            .should(
                "contain",
                "R$"
            );

    });

    it("deve filtrar produto pelo nome", () => {

        cy.get('[data-cy="produto-busca"]')
            .type("Produto teste");

        cy.get('[data-cy="produto-nome"]')
            .should(
                "contain",
                "Produto teste"
            );
    });

    it("deve filtrar produto por categoria", () => {

        cy.get('[data-cy="produto-filtro-categoria"]')
            .select("1");

        cy.get('[data-cy="produto-nome"]')
            .should(
                "contain",
                "Produto teste"
            );
    });

    it("deve mostrar mensagem quando filtro não encontrar produto", () => {

        cy.get('[data-cy="produto-busca"]')
            .type("Produto inexistente");

        cy.contains("Nenhum produto encontrado").should("exist");
    });

    it("deve mostrar mensagem quando não existir produtos", () => {

        cy.intercept(
            "GET",
            "**/api/products*",
            {
                statusCode: 200,
                body: {
                    data: [],
                    pagination: {
                        page: 1,
                        limit: 10,
                        total: 0,
                        totalPages: 1
                    }
                }
            }
        )
            .as("semProdutos");

        cy.reload();

        cy.wait("@semProdutos");

        cy.contains("Nenhum produto cadastrado").should("exist");
    });

    it("deve mostrar erro quando API falhar", () => {

        cy.intercept(
            "GET",
            "**/api/products*",
            {
                statusCode: 500
            }
        )
            .as("erroProdutos");

        cy.reload();

        cy.wait("@erroProdutos");

        cy.contains("Erro ao carregar produtos").should("exist");

    });

    it("não deve permitir próxima página quando não existir", () => {

        cy.get('[data-cy="produto-proxima"]')
            .should(
                "be.disabled"
            );
    });

    it("não deve permitir voltar página inicial", () => {

        cy.get('[data-cy="produto-anterior"]')
            .should(
                "be.disabled"
            );

    });

    it("deve alterar quantidade por página", () => {

        cy.intercept(
            "GET",
            "**/api/products*limit=20*"
        )
            .as("limite20");

        cy.get('[data-cy="produto-limit"]')
            .select("20");

        cy.wait("@limite20");
    });

    it("deve abrir tela de novo produto", () => {

        cy.get('[data-cy="produto-novo"]')
            .click();

        cy.url()
            .should(
                "include",
                "/admin/produtos/cadastrar"
            );
    });

    it("deve editar um produto", () => {

        cy.get('[data-cy^="produto-editar-"]')
            .first()
            .click();

        cy.url()
            .should(
                "include",
                "/editar"
            );
    });

    it("deve abrir edição com id correto", () => {

        cy.get('[data-cy="produto-editar-1"]')
            .click();

        cy.url()
            .should(
                "include",
                "/editar/1"
            );
    });

    it("não deve deletar ao cancelar exclusão", () => {

        cy.get('[data-cy^="produto-deletar-"]')
            .click();

        cy.contains("Cancelar").click();

        cy.get('@deletarProduto.all')
            .should(
                "have.length",
                0
            );
    });

    it("deve mostrar erro ao falhar exclusão", () => {

        cy.intercept(
            "DELETE",
            "**/api/products/*",
            {
                statusCode: 500,
                body: {
                    message: "Erro ao deletar"
                }
            }
        )
            .as("erroDelete");

        cy.get('[data-cy^="produto-deletar-"]')
            .click();

        cy.contains(
            "button",
            "Excluir"
        )
            .should("be.visible")
            .click();

        cy.wait("@erroDelete");

        cy.contains("Erro ao deletar").should("exist");
    });

    it("deve deletar um produto com sucesso", () => {

        cy.get('[data-cy^="produto-deletar-"]')
            .click();

        cy.contains("Excluir produto").should("exist");

        cy.contains("button", "Excluir").click();

        cy.wait("@deletarProduto");

        cy.contains("Produto deletado com sucesso").should("exist");
    });
});