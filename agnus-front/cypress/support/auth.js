Cypress.Commands.add("loginAdmin", () => {


    cy.window().then((win) => {


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

                },

                token: "fake-admin"

            })
        );


    });


});