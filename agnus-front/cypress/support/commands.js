/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }
Cypress.Commands.add("loginAdmin", () => {

    const usuario = {

        nome: "Admin Cypress",
        email: "admin.cypress@teste.com",
        senha: "12345678!Aa",
        tipo: "administrador"

    };

    cy.request({

        method: "POST",
        url: "https://localhost/api/users",
        body: usuario,
        failOnStatusCode: false

    })
        .then((response) => {

            cy.log(
                "Criacao usuario:",
                JSON.stringify(response.body)
            );

            cy.request({

                method: "POST",
                url: "https://localhost/api/auth/login",
                headers: {

                    "Content-Type": "application/json"

                },

                body: {
                    email: usuario.email,
                    senha: usuario.senha
                }
            })
                .then((login) => {

                    cy.log(
                        "Login:",
                        JSON.stringify(login.body)
                    );

                    expect(login.status)
                        .eq(200);

                    localStorage.setItem(
                        "auth_token",
                        login.body.token
                    );

                    localStorage.setItem(
                        "auth",
                        JSON.stringify(login.body)
                    );
                });
        });
});