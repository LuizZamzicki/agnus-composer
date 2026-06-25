describe("Menu Admin", () => {


    beforeEach(() => {


        cy.clearLocalStorage();



        cy.intercept("GET", "**/users*", {

            statusCode: 200,

            body: {

                data: [],

                pagination: {
                    page: 1,
                    totalPages: 1,
                    total: 0
                }

            }

        });



        cy.intercept("GET", "**/products*", {

            statusCode: 200,

            body: {

                data: [],

                pagination: {
                    page: 1,
                    totalPages: 1,
                    total: 0
                }

            }

        });



        cy.intercept("GET", "**/categories*", {

            statusCode: 200,

            body: {

                data: [],

                pagination: {
                    page: 1,
                    totalPages: 1,
                    total: 0
                }

            }

        });



        cy.intercept("GET", "**/orders*", {

            statusCode: 200,

            body: []

        });



        cy.intercept("GET", "**/dashboard*", {

            statusCode: 200,

            body: {

                data: {

                    totalVendas: 100,
                    totalPedidos: 50,
                    totalUsuarios: 25,
                    totalProdutos: 150

                }

            }

        });



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



        cy.get('[data-cy="menu-dashboard"]')
            .should("be.visible");


    });









    it("deve abrir dashboard pelo menu", () => {


        cy.get('[data-cy="menu-dashboard"]')
            .click({ force: true });



        cy.location("pathname", {

            timeout: 15000

        })
            .should(
                "eq",
                "/admin/dashboard"
            );


    });








    it("deve abrir usuários pelo menu", () => {


        cy.get('[data-cy="menu-usuarios"]')
            .click({ force: true });



        cy.location("pathname")
            .should(
                "eq",
                "/admin/usuarios"
            );


    });










    it("deve abrir categorias", () => {


        cy.get('[data-cy="submenu-categorias"]')
            .should("be.visible")
            .click();



        cy.location("pathname")
            .should(
                "eq",
                "/admin/categorias"
            );


    });










    it("deve abrir produtos", () => {


        cy.get('[data-cy="submenu-listar-produtos"]')
            .should("be.visible")
            .click();



        cy.location("pathname")
            .should(
                "eq",
                "/admin/produtos"
            );


    });










    it("deve abrir pedidos", () => {


        cy.get('[data-cy="menu-pedidos"]')
            .click({ force: true });



        cy.location("pathname")
            .should(
                "eq",
                "/admin/pedidos"
            );


    });










    it("deve fechar e abrir submenu produtos", () => {


        cy.get('[data-cy="menu-produtos"]')
            .click();



        cy.get('[data-cy="submenu-listar-produtos"]')
            .should("not.exist");



        cy.get('[data-cy="menu-produtos"]')
            .click();



        cy.get('[data-cy="submenu-listar-produtos"]')
            .should("exist");


    });










    it("deve manter produtos ativo quando estiver na rota", () => {


        cy.get('[data-cy="menu-produtos"]')
            .should(
                "have.class",
                "active"
            );


    });










    it("deve fazer logout", () => {


        cy.get('[data-cy="menu-logout"]')
            .click({ force: true });



        cy.location("pathname")
            .should(
                "eq",
                "/login"
            );



        cy.window()
            .then(win => {


                expect(
                    win.localStorage.getItem("auth_token")
                )
                    .to.be.null;



                expect(
                    win.localStorage.getItem("auth")
                )
                    .to.be.null;


            });


    });










    it("botão voltar home deve funcionar", () => {


        cy.get(".retorna-Home")
            .click();



        cy.location("pathname")
            .should(
                "eq",
                "/"
            );


    });



});