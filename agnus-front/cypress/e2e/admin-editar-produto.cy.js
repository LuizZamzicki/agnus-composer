describe("Admin Produtos", () => {

    const produto = {
        id_produto: 1,
        nome: "Produto Teste Cypress",
        descricao: "Produto criado para edição",
        preco_custo: 50,
        preco_base: 100,
        ativo: true,
        id_categoria: 1
    };

    function mockApi() {

        cy.intercept("GET", "**/categories*", {
            body: {
                data: [{ id_categoria: 1, nome: "Vestidos" }],
                pagination: { page: 1, limit: 100, total: 1, totalPages: 1 }
            }
        });

        cy.intercept("POST", "**/categories", {
            statusCode: 201,
            body: { id: 2, nome: "Nova" }
        });

        cy.intercept("GET", /\/products(\?.*)?$/, {
            body: {
                data: [produto],
                pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }
            }
        });

        cy.intercept("GET", "**/products/1", { body: produto }).as("produto");

        cy.intercept("GET", "**/product-grades/1", {
            body: [
                { id_produto_grade: 1, nome: "M", acrescimo: 0 },
                { id_produto_grade: 2, nome: "G", acrescimo: 5 }
            ]
        });

        cy.intercept("GET", "**/product-colors/1", {
            body: [
                {
                    id_produto_cor: 1,
                    nome: "Azul",
                    tonalidade: "#0000ff",
                    acrescimo: 0,
                    fotos: ["/produto_fotos/azul.png"]
                },
                {
                    id_produto_cor: 2,
                    nome: "Preto",
                    tonalidade: "#000000",
                    acrescimo: 0,
                    fotos: ["/produto_fotos/preto.png"]
                }
            ]
        });

        cy.intercept("GET", "**/product-photos/1", { body: [] });

        cy.intercept("POST", "**/products", {
            statusCode: 201,
            body: { id_produto: 2 }
        }).as("criarProduto");

        cy.intercept("PUT", "**/products/1", {
            statusCode: 200,
            body: produto
        }).as("atualizarProduto");
    }

    function visitar(caminho) {

        cy.visit(caminho, {

            onBeforeLoad(win) {
                win.localStorage.setItem("auth_token", "fake-admin-token");

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
    }

    beforeEach(() => {
        cy.clearLocalStorage();
        mockApi();
    });

    function campo(selector) {

        return cy.get(selector)
            .should("exist")
            .scrollIntoView({
                offset: {
                    top: -150,
                    left: 0
                }
            })
            .should("be.visible");
    }

    it("deve cadastrar produto completo", () => {

        visitar("/admin/produtos/cadastrar");

        campo('[data-cy="produto-nome"]')
            .type("Vestido Aurora");

        campo('[data-cy="produto-descricao"]')
            .type("Vestido elegante para teste");

        campo('[data-cy="produto-custo"]')
            .type("50");

        campo('[data-cy="produto-preco-venda"]')
            .type("120");

        cy.get('[data-cy="abrir-modal-categoria"]')
            .click({ force: true });

        campo('[data-cy="nova-categoria-nome"]')
            .type("Vestidos");

        cy.get('[data-cy="salvar-categoria"]')
            .click({ force: true });

        campo('[data-cy="nova-grade-nome"]')
            .type("M");

        cy.get('[data-cy="nova-grade-nome"]')
            .closest(".admin-grade-new-form")
            .find('input[type="number"]')
            .type("0");

        cy.get('[data-cy="adicionar-grade"]')
            .click({ force: true });

        campo('[data-cy="nova-cor-nome"]')
            .type("Azul");

        campo('[data-cy="nova-cor-acrescimo"]')
            .type("10");

        cy.get('[data-cy="adicionar-cor"]')
            .click({ force: true });

        cy.get('.admin-form-color-card')
            .should("exist");

        cy.get('[data-cy^="upload-foto-cor-"]')
            .should("exist")
            .last()
            .selectFile(
                "cypress/fixtures/imagem-teste.png",
                {
                    force: true
                }
            );

        cy.get('[data-cy="salvar-produto"]')
            .click({ force: true });

        cy.wait("@criarProduto")
            .its("request.body")
            .should((body) => {
                expect(body.nome).to.eq("Vestido Aurora");
                expect(body.grades).to.have.length(1);
                expect(body.cores[0].fotos_upload).to.have.length(1);
            });

        cy.location("pathname")
            .should("eq", "/admin/produtos");
    });

    it("deve abrir edição pelo botão da lista", () => {

        visitar("/admin/produtos");

        cy.contains("td", "Produto Teste Cypress")
            .parents("tr")
            .find('[data-cy^="produto-editar-"]')
            .click();

        cy.url()
            .should(
                "include",
                "/editar/1"
            );
    });

    it("deve carregar dados do produto ao abrir edição", () => {

        visitar("/admin/produtos/editar/1");

        cy.wait("@produto");

        cy.get('[data-cy="produto-nome"]')
            .should("have.value", "Produto Teste Cypress");

        cy.get('[data-cy="produto-descricao"]')
            .should("have.value", "Produto criado para edição");
    });

    it("deve remover grade do produto", () => {

        visitar("/admin/produtos/editar/1");

        cy.get('[data-cy="grade-item"]')
            .should("have.length", 2);

        cy.get('[data-cy="remover-grade"]')
            .first()
            .click({ force: true });

        cy.get('[data-cy="grade-item"]')
            .should("have.length", 1);
    });

    it("deve remover cor do produto", () => {

        visitar("/admin/produtos/editar/1");

        cy.get('.admin-form-color-card')
            .should("have.length", 2);

        cy.get('[data-cy="remover-cor"]')
            .first()
            .click({ force: true });

        cy.get('.admin-form-color-card')
            .should("have.length", 1);
    });

    it("não deve salvar produto sem grade", () => {

        visitar("/admin/produtos/editar/1");

        cy.get('[data-cy="grade-item"]')
            .should("have.length", 2);

        cy.get('[data-cy="remover-grade"]')
            .first()
            .click({ force: true });

        cy.get('[data-cy="grade-item"]')
            .should("have.length", 1);

        cy.get('[data-cy="remover-grade"]')
            .click({ force: true });

        cy.get('[data-cy="grade-item"]')
            .should("not.exist");

        cy.get('[data-cy="salvar-produto"]')
            .click({ force: true });

        cy.contains("Adicione pelo menos uma grade")
            .should("exist");
    });

    it("não deve salvar cor sem foto", () => {

        visitar("/admin/produtos/cadastrar");

        campo('[data-cy="produto-nome"]')
            .type("Sem foto");

        campo('[data-cy="produto-custo"]')
            .type("50");

        campo('[data-cy="produto-preco-venda"]')
            .type("120");

        campo('[data-cy="nova-grade-nome"]')
            .type("M");

        cy.get('[data-cy="adicionar-grade"]')
            .click({ force: true });

        campo('[data-cy="nova-cor-nome"]')
            .type("Azul");

        cy.get('[data-cy="adicionar-cor"]')
            .click({ force: true });

        cy.get('[data-cy="salvar-produto"]')
            .click({ force: true });

        cy.contains("Adicione pelo menos uma cor com pelo menos uma foto")
            .should("exist");
    });

    it("deve editar produto existente e alterar grade/cor", () => {

        visitar("/admin/produtos/editar/1");

        cy.wait("@produto");

        cy.get('[data-cy="produto-nome"]')
            .should("have.value", "Produto Teste Cypress");

        cy.get('[data-cy="produto-descricao"]')
            .clear()
            .type("Descrição alterada Cypress");

        cy.get('[data-cy="nova-grade-nome"]')
            .type("GG");

        cy.get('[data-cy="nova-grade-nome"]')
            .closest(".admin-grade-new-form")
            .find('input[type="number"]')
            .type("5");

        cy.get('[data-cy="adicionar-grade"]')
            .click({ force: true });

        cy.get('[data-cy="nova-cor-nome"]')
            .scrollIntoView({
                offset: {
                    top: -150,
                    left: 0
                }
            })
            .type("Vermelho", {
                force: true
            });

        cy.get('[data-cy="nova-cor-acrescimo"]')
            .scrollIntoView({
                offset: {
                    top: -150,
                    left: 0
                }
            })
            .type("5", {
                force: true
            });

        cy.get('[data-cy="adicionar-cor"]')
            .click({ force: true });

        cy.contains("Vermelho")
            .should("exist");

        cy.get('[data-cy="salvar-produto"]')
            .click({ force: true });

        cy.wait("@atualizarProduto")
            .its("request.body")
            .should((body) => {
                expect(body.descricao).to.eq("Descrição alterada Cypress");
                expect(body.grades.map((grade) => grade.nome)).to.include("GG");
                expect(body.cores.map((cor) => cor.nome)).to.include("Vermelho");
            });

        cy.location("pathname")
            .should("eq", "/admin/produtos");
    });
});
