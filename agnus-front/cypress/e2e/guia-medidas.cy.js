// "Ver medidas" na página do produto, contra o site de verdade (sem simular a API).
// Os produtos precisam ter a tabela de medidas cadastrada no admin.

describe("Guia de medidas", () => {
    beforeEach(() => {
        cy.intercept("GET", "**/notifications/me", { body: { data: [], naoLidas: 0 } });
    });

    it("bloco antes das avaliações abre o guia com desenho, tabela e explicação", () => {
        cy.visit("/produto/1");

        // O bloco vem antes da seção de avaliações.
        cy.get('[data-cy="medidas-chamada"]').should("be.visible").then(($chamada) => {
            const avaliacoes = Cypress.$(".avaliacoes-section")[0];
            expect($chamada[0].compareDocumentPosition(avaliacoes) & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(0);
        });

        cy.get('[data-cy="ver-medidas"]').click();
        cy.get('[data-cy="janela-medidas"]').should("be.visible").and("contain", "Como medir");
        cy.get('[data-cy="tabela-medidas"] tbody tr').should("have.length", 4);
        // Medidas reais da YouDraw: largura e altura (comprimento) da peça.
        cy.get('[data-cy="tabela-medidas"]').should("contain", "Largura").and("contain", "Comprimento").and("contain", "64");
        cy.get(".medidas-desenho .medidas-marca").should("have.length", 2);
        // A tabela precisa estar visível de verdade (já sumiu com altura zero dentro da janela).
        cy.get('[data-cy="tabela-medidas"]').scrollIntoView().should("be.visible").invoke("outerHeight").should("be.greaterThan", 150);
        cy.wait(300);
        cy.screenshot("guia-medidas-camiseta", { capture: "viewport" });

        // Passar o mouse numa medida destaca a linha no desenho.
        cy.get(".medidas-legenda li").first().trigger("mouseover");
        cy.get(".medidas-marca.ativa").should("have.length", 1);

        // Calculadora: tórax de 100 cm na DryFit Masculina (M = 53 cm de largura => 106 cm de volta, 6 cm de folga).
        cy.get('[data-cy="medidas-calculadora"]').type("100");
        cy.get('[data-cy="medidas-sugestao"]').should("contain", "Sugerimos o M").and("contain", "6 cm");

        // Esc fecha e devolve o foco ao botão.
        cy.get("body").type("{esc}");
        cy.get('[data-cy="janela-medidas"]').should("not.exist");
        cy.focused().should("have.attr", "data-cy", "ver-medidas");
    });

    it("link ao lado de Tamanho marca o tamanho escolhido", () => {
        cy.visit("/produto/1");
        cy.contains('[data-cy^="tamanho-"]', /^G$/).click();
        cy.get('[data-cy="ver-medidas-link"]').click();
        cy.get('[data-cy="tabela-medidas"] tr.escolhido').should("have.length", 1).and("contain", "G").and("contain", "seu tamanho");
        cy.get('[data-cy="fechar-medidas"]').click();
        cy.get('[data-cy="janela-medidas"]').should("not.exist");
    });

    it("regata mostra o desenho da regata com as medidas da YouDraw", () => {
        cy.visit("/produto/4");
        cy.get('[data-cy="ver-medidas"]').click();
        cy.get('[data-cy="tabela-medidas"]').should("contain", "81").and("contain", "59");
        cy.get(".medidas-desenho .medidas-marca").should("have.length", 2);
        cy.get('[data-cy="tabela-medidas"]').scrollIntoView({ offset: { top: -260, left: 0 } });
        cy.wait(300);
        cy.screenshot("guia-medidas-regata", { capture: "viewport" });
    });

    it("produto sem tabela (short) não mostra Ver medidas", () => {
        cy.visit("/produto/12");
        cy.get(".avaliacoes-section").should("exist");
        cy.get('[data-cy="medidas-chamada"]').should("not.exist");
        cy.get('[data-cy="ver-medidas-link"]').should("not.exist");
    });

    it("no celular abre como folha e cabe na tela", () => {
        cy.viewport(390, 844);
        cy.visit("/produto/9");
        cy.get('[data-cy="ver-medidas"]').scrollIntoView().click();
        cy.get('[data-cy="janela-medidas"]').should("be.visible").and("contain", "largura");
        cy.window().then((win) => {
            expect(win.document.documentElement.scrollWidth, "sem rolagem horizontal").to.be.at.most(390);
        });
        cy.wait(300);
        cy.screenshot("guia-medidas-celular", { capture: "viewport" });
    });
});

describe("Editor da tabela de medidas (admin)", () => {
    it("escolhe o modelo, preenche com a referência e avisa medidas vazias", () => {
        cy.intercept("GET", "**/categories*", { body: { data: [{ id_categoria: 22, nome: "Camisetas" }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } } });
        cy.visit("/admin/produtos/cadastrar", {
            onBeforeLoad(win) {
                win.localStorage.setItem("auth_token", "fake-admin-token");
                win.localStorage.setItem("auth", JSON.stringify({ id_usuario: 1, tipo: "administrador", user: { id_usuario: 1, tipo: "administrador" } }));
            },
        });

        cy.get('[data-cy="editor-medidas"]').scrollIntoView().should("be.visible");
        cy.get('[data-cy="medidas-modelo"]').select("Regata");
        cy.get('[data-cy="medidas-grade"]').should("contain", "Largura").and("contain", "Comprimento");
        cy.contains("8 medida(s) sem preencher").scrollIntoView().should("be.visible");

        // Referência = Tank Top Machão Suedine da YouDraw.
        cy.get('[data-cy="medidas-referencia"]').click();
        cy.get('[data-cy="medida-M-largura"]').should("have.value", "54");
        cy.get('[data-cy="medida-GG-comprimento"]').should("have.value", "81");
        cy.contains("sem preencher").should("not.exist");

        cy.get('[data-cy="medida-M-largura"]').clear().type("54,5");
        cy.get('[data-cy="medidas-modelo"]').select("Sem tabela de medidas");
        cy.get('[data-cy="medidas-grade"]').should("not.exist");
    });
});
