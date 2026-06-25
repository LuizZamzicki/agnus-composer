describe("Cadastro de Produto Admin", () => {

    const token = "fake-admin-token";

    // function headers() {
    //     return {
    //         Authorization: `Bearer ${token}`
    //     };
    // }

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

        return cy.get(selector, {
            timeout: 15000
        })
            .should("exist")
            .scrollIntoView({
                offset: {
                    top: -150,
                    left: 0
                }
            })
            .should("be.visible");

    }


    it("deve abrir tela de cadastro", () => {

        cy.visit("/admin/produtos/cadastrar");

        campo(
            '[data-cy="produto-nome"]'
        );

        cy.url()
            .should(
                "include",
                "/admin/produtos/cadastrar"
            );

    });


    it("não deve salvar produto sem nome", () => {

        cy.visit("/admin/produtos/cadastrar");

        campo(
            '[data-cy="salvar-produto"]'
        )
            .click({
                force: true
            });


        cy.contains(
            "Por favor, preencha o nome do produto"
        )
            .should("exist");

    });



    it("deve criar categoria", () => {


        cy.visit("/admin/produtos/cadastrar");


        campo(
            '[data-cy="abrir-modal-categoria"]'
        )
            .click({
                force: true
            });


        campo(
            '[data-cy="nova-categoria-nome"]'
        )
            .type(
                "Categoria Cypress"
            );


        cy.get(
            '[data-cy="salvar-categoria"]'
        )
            .click({
                force: true
            });


        cy.contains(
            "Categoria Cypress"
        )
            .should("exist");

    });



    it("deve adicionar e remover grade", () => {


        cy.visit("/admin/produtos/cadastrar");


        campo(
            '[data-cy="nova-grade-nome"]'
        )
            .type("M");


        cy.get(
            '[data-cy="adicionar-grade"]'
        )
            .click({
                force: true
            });


        cy.get(
            '[data-cy="grade-item"]'
        )
            .should(
                "contain.text",
                "M"
            );


        cy.get(
            '[data-cy="remover-grade"]'
        )
            .click({
                force: true
            });


        cy.get(
            '[data-cy="grade-item"]'
        )
            .should(
                "not.exist"
            );

    });



    it("deve adicionar e remover cor", () => {


        cy.visit("/admin/produtos/cadastrar");


        campo(
            '[data-cy="nova-cor-nome"]'
        )
            .type("Azul");


        campo(
            '[data-cy="nova-cor-acrescimo"]'
        )
            .type("10");


        cy.get(
            '[data-cy="adicionar-cor"]'
        )
            .click({
                force: true
            });


        cy.get(
            '.admin-form-color-card'
        )
            .should(
                "exist"
            );


        cy.get(
            '[data-cy="remover-cor"]'
        )
            .click({
                force: true
            });


        cy.get(
            '.admin-form-color-card'
        )
            .should(
                "not.exist"
            );

    });



    it("deve cadastrar produto completo", () => {


        cy.visit("/admin/produtos/cadastrar");


        campo(
            '[data-cy="produto-nome"]'
        )
            .type(
                "Produto Cadastro Cypress"
            );


        campo(
            '[data-cy="produto-descricao"]'
        )
            .type(
                "Produto criado via Cypress"
            );


        campo(
            '[data-cy="produto-custo"]'
        )
            .type("50");


        campo(
            '[data-cy="produto-preco-venda"]'
        )
            .type("120");



        cy.get(
            '[data-cy="abrir-modal-categoria"]'
        )
            .click({
                force: true
            });



        campo(
            '[data-cy="nova-categoria-nome"]'
        )
            .clear()
            .type(
                "Categoria Cypress " + Date.now()
            );



        cy.get(
            '[data-cy="salvar-categoria"]'
        )
            .click({
                force: true
            });



        // espera modal fechar
        cy.get(
            '[data-cy="nova-categoria-nome"]',
            {
                timeout: 10000
            }
        )
            .should(
                "not.exist"
            );



        // agora grade
        cy.get(
            '[data-cy="nova-grade-nome"]',
            {
                timeout: 10000
            }
        )
            .scrollIntoView({
                offset: {
                    top: -150,
                    left: 0
                }
            })
            .should("be.visible")
            .type(
                "M"
            );



        cy.get(
            '[data-cy="adicionar-grade"]'
        )
            .click({
                force: true
            });



        cy.get(
            '[data-cy="grade-item"]'
        )
            .should(
                "contain.text",
                "M"
            );



        // cor

        cy.get(
            '[data-cy="nova-cor-nome"]'
        )
            .scrollIntoView({
                offset: {
                    top: -150,
                    left: 0
                }
            })
            .should("be.visible")
            .type(
                "Azul"
            );



        cy.get(
            '[data-cy="nova-cor-acrescimo"]'
        )
            .type(
                "0"
            );



        cy.get(
            '[data-cy="adicionar-cor"]'
        )
            .click({
                force: true
            });



        cy.get(
            '.admin-form-color-card'
        )
            .should(
                "exist"
            );



        cy.get(
            '[data-cy^="upload-foto-cor-"]'
        )
            .last()
            .selectFile(
                "cypress/fixtures/imagem-teste.png",
                {
                    force: true
                }
            );



        cy.get(
            '[data-cy="salvar-produto"]'
        )
            .click({
                force: true
            });



        cy.url({
            timeout: 15000
        })
            .should(
                "include",
                "/admin/produtos"
            );


    });


});