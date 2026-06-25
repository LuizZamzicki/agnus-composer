describe("Categorias Admin", () => {


    beforeEach(() => {


        cy.clearLocalStorage();



        cy.intercept(
            "GET",
            "**/categories*",
            {
                statusCode: 200,
                body: {
                    data: [
                        {
                            id_categoria: 1,
                            nome: "Camisetas"
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
            }
        ).as("categorias");



        cy.intercept(
            "POST",
            "**/categories",
            {
                statusCode: 201,
                body: {
                    id_categoria: 2,
                    nome: "Camisetas"
                }
            }
        ).as("criarCategoria");




        cy.visit("/admin/categorias", {


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
                            nome: "Admin",
                            email: "admin@email.com",
                            tipo: "administrador"

                        }

                    })
                );


            }


        });



        cy.wait("@categorias");


    });





    it("deve abrir tela de categorias", () => {


        cy.get('[data-cy="tabela-categorias"]')
            .should("exist");


    });





    it("deve abrir modal de cadastro", () => {


        cy.get('[data-cy="btn-nova-categoria"]')
            .click();



        cy.contains("Nova Categoria")
            .should("exist");


    });





    it("deve cadastrar uma categoria", () => {


        cy.get('[data-cy="btn-nova-categoria"]')
            .click();



        cy.get('[data-cy="input-nome-categoria"]')
            .type("Camisetas");



        cy.get('[data-cy="btn-salvar-categoria"]')
            .click();



        cy.wait("@criarCategoria");



        cy.contains(
            "Categoria cadastrada com sucesso!"
        )
            .should("exist");


    });





    it("deve filtrar categoria", () => {


        cy.get('[data-cy="buscar-categoria"]')
            .type("Camisetas");



        cy.get('[data-cy="categoria-item"]')
            .should(
                "contain.text",
                "Camisetas"
            );


    });



});