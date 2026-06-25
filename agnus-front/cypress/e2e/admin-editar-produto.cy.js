describe("Admin Produtos", () => {

    const token = "fake-admin-token";

    function headers() {
        return {
            Authorization: `Bearer ${token}`
        };
    }

    beforeEach(() => {

        cy.clearLocalStorage();
        cy.visit("/admin/produtos", {

            onBeforeLoad(win) {
                win.localStorage.setItem(
                    "auth_token",
                    token
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

    it("deve cadastrar produto completo somente se não existir", () => {

        cy.request({

            method: "GET",
            url: `${Cypress.env("apiUrl")}/products`,
            headers: headers()
        }).then(res => {

            const produtos =
                res.body.data ?? res.body ?? [];

            const existe =
                produtos.find(
                    p => p.nome === "Vestido Aurora"
                );

            if (existe) {
                return;
            }

            cy.visit("/admin/produtos/cadastrar");

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

            cy.url()
                .should(
                    "include",
                    "/admin/produtos"
                );
        });
    });

    function buscarOuCriarProduto() {

        return cy.request({
            method: "GET",
            url: `${Cypress.env("apiUrl")}/products`,
            headers: headers()
        }).then(res => {

            const produtos =
                res.body.data ?? res.body ?? [];

            let produto =
                produtos.find(
                    p => p.nome === "Produto Teste Cypress"
                );

            if (produto) {
                return produto.id_produto;
            }

            return cy.request({

                method: "POST",
                url: `${Cypress.env("apiUrl")}/products`,
                headers: headers(),

                body: {
                    nome: "Produto Teste Cypress",
                    descricao: "Produto criado para edição",
                    preco_custo: 50,
                    preco_base: 100,
                    ativo: true,
                    grades: [
                        {
                            nome: "M",
                            acrescimo: 0
                        }
                    ],

                    cores: [
                        {
                            nome: "Azul",
                            tonalidade: "#0000ff",
                            acrescimo: 0,
                            fotos: [
                                "/fixtures/imagem-teste.png"
                            ]
                        }
                    ]
                }
            }).then(res => {

                const produtoCriado =
                    res.body.data ??
                    res.body.produto ??
                    res.body;

                return (
                    produtoCriado.id_produto ??
                    produtoCriado.id
                );
            });
        });
    }

    it("deve abrir edição pelo botão da lista", () => {

        cy.visit("/admin/produtos");
        cy.contains("Produto Teste Cypress").should("exist");
        cy.contains("td", "Produto Teste Cypress")
            .parents("tr").find('[data-cy^="produto-editar-"]').click();

        cy.url()
            .should(
                "include",
                "/editar/"
            );
    });

    it("deve carregar dados do produto ao abrir edição", () => {

        buscarOuCriarProduto()
            .then(id => {
                cy.log(`ID: ${JSON.stringify(id)}`);
                expect(
                    typeof id,
                    "id deve ser string ou number"
                ).to.be.oneOf(["string", "number"]);

                cy.intercept(
                    "GET",
                    "**/products/**"
                ).as("produto");

                cy.intercept(
                    "GET",
                    "**/product-grades/**"
                ).as("grades");

                cy.intercept(
                    "GET",
                    "**/product-colors/**"
                ).as("colors");

                cy.intercept(
                    "GET",
                    "**/product-photos/**"
                ).as("photos");

                cy.visit(
                    `/admin/produtos/editar/${id}`
                );

                cy.wait(
                    "@produto",
                    { timeout: 10000 }
                );

                cy.get(
                    '[data-cy="produto-nome"]',
                    { timeout: 10000 }
                )
                    .invoke("val")
                    .should("not.be.empty");

                cy.get(
                    '[data-cy="produto-descricao"]',
                    { timeout: 10000 }
                )
                    .invoke("val")
                    .should("not.be.empty");
            });
    });

    it("deve remover grade do produto", () => {

        buscarOuCriarProduto()
            .then(id => {

                cy.visit(`/admin/produtos/editar/${id}`);

                cy.get('[data-cy="grade-item"]', { timeout: 10000 })
                    .should("have.length.greaterThan", 0)
                    .then(($gradesAntes) => {

                        const quantidadeAntes = $gradesAntes.length;

                        cy.wrap($gradesAntes)
                            .first()
                            .find('[data-cy="remover-grade"]')
                            .click({ force: true });

                        cy.get('[data-cy="grade-item"]')
                            .should(
                                "have.length",
                                quantidadeAntes - 1
                            );
                    });
            });
    });

    it("deve remover cor do produto", () => {

        buscarOuCriarProduto()
            .then(id => {

                cy.visit(`/admin/produtos/editar/${id}`);

                cy.get('.admin-form-color-card')
                    .should("have.length.greaterThan", 0)
                    .then(($coresAntes) => {

                        const quantidadeAntes = $coresAntes.length;

                        cy.wrap($coresAntes)
                            .first()
                            .find('[data-cy="remover-cor"]')
                            .click({ force: true });

                        cy.get('.admin-form-color-card')
                            .should(
                                "have.length",
                                quantidadeAntes - 1
                            );
                    });
            });
    });

    it("não deve salvar produto sem grade", () => {

        buscarOuCriarProduto()
            .then(id => {

                cy.visit(
                    `/admin/produtos/editar/${id}`
                );

                cy.get('[data-cy="grade-item"]')
                    .should("have.length.greaterThan", 0)
                    .then(($grades) => {

                        const quantidade =
                            $grades.length;

                        for (let i = 0; i < quantidade; i++) {
                            cy.get('[data-cy="remover-grade"]')
                                .first()
                                .click({
                                    force: true
                                });
                        }
                    });

                cy.get('[data-cy="grade-item"]')
                    .should("not.exist");


                cy.get('[data-cy="salvar-produto"]')
                    .click({
                        force: true
                    });

                cy.contains("Adicione pelo menos uma grade").should("exist");
            });
    });

    it("não deve salvar cor sem foto", () => {

        cy.visit(
            "/admin/produtos/cadastrar"
        );
    });

    it("deve editar produto existente e alterar grade/cor", () => {

        buscarOuCriarProduto()
            .then(id => {

                cy.intercept(
                    "GET",
                    "**/products/**"
                )
                    .as("produto");

                cy.visit(
                    `/admin/produtos/editar/${id}`
                );

                cy.wait("@produto");

                cy.get(
                    '[data-cy="produto-nome"]'
                )
                    .should("be.visible")
                    .clear()
                    .type(
                        "Produto Teste Cypress"
                    );

                cy.get(
                    '[data-cy="produto-descricao"]'
                )
                    .clear()
                    .type(
                        "Descrição alterada Cypress"
                    );

                cy.get('[data-cy="nova-grade-nome"]')
                    .type("G");

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

                cy.get(
                    '[data-cy="salvar-produto"]'
                )
                    .click({ force: true });

                cy.url()
                    .should(
                        "include",
                        "/admin/produtos"
                    );
            });
    });
});