// Perguntas frequentes, páginas do rodapé, parcelas, bloco de confiança e faixa de avisos.
describe("Dúvidas e páginas institucionais", () => {
    beforeEach(() => {
        cy.intercept("GET", "**/api/products*", { body: { data: [], pagination: { page: 1, totalPages: 1, total: 0 } } });
        cy.intercept("GET", "**/api/categories*", { body: [] });
    });

    it("home: versão curta das perguntas abre e fecha e leva para a página completa", () => {
        cy.visit("/");
        cy.get('[data-cy="duvidas-home"]').scrollIntoView().within(() => {
            cy.get("details").should("have.length.at.least", 4);
            cy.get('[data-cy="duvida-home-0"]').should("not.have.attr", "open");
            cy.get('[data-cy="duvida-home-0"] summary').click();
            cy.get('[data-cy="duvida-home-0"]').should("have.attr", "open");
            cy.get('[data-cy="duvida-home-0"] p').should("be.visible").and("not.be.empty");
            cy.get('[data-cy="duvida-home-0"] summary').click();
            cy.get('[data-cy="duvida-home-0"]').should("not.have.attr", "open");
        });
        cy.get('[data-cy="ver-todas-duvidas"]').click();
        cy.location("pathname").should("eq", "/duvidas");
    });

    it("página de dúvidas: assuntos, respostas com as regras da loja e WhatsApp", () => {
        cy.visit("/duvidas");
        cy.get('[data-cy="pagina-duvidas"] h1').should("contain", "Perguntas frequentes");
        cy.contains(".duvidas-assuntos a", "Trocas e devoluções").click();
        cy.contains("details", "Qual é o prazo para devolver?").find("summary").click();
        cy.contains("details", "Qual é o prazo para devolver?").should("contain", "7 dias").and("contain", "90 dias");
        cy.contains("details", "Quais são as formas de pagamento?").find("summary").click();
        cy.contains("details", "Quais são as formas de pagamento?").should("contain", "2x não há juros");
        cy.get('[data-cy="fale-conosco"] a[href^="https://wa.me/5544991389614"]').should("exist");
        cy.get('[data-cy="fale-conosco"] a[href^="https://wa.me/5544997336744"]').should("exist");
    });

    it("rodapé leva para cada página institucional", () => {
        const paginas = [
            ["Perguntas frequentes", "/duvidas", "pagina-duvidas"],
            ["Trocas e devoluções", "/trocas-e-devolucoes", "pagina-trocas"],
            ["Entrega e prazos", "/entrega", "pagina-entrega"],
            ["Sobre a Agnus", "/sobre", "pagina-sobre"],
            ["Privacidade", "/privacidade", "pagina-privacidade"]
        ];
        cy.visit("/");
        paginas.forEach(([rotulo, caminho, cy_]) => {
            cy.get('[data-cy="footer-ajuda"]').contains("a", rotulo).click();
            cy.location("pathname").should("eq", caminho);
            cy.get(`[data-cy="${cy_}"]`).should("be.visible");
        });
        cy.get("footer").should("contain", "contato@agnusfit.com");
    });

    it("trocas: frete da troca de tamanho é do cliente; defeito é da loja", () => {
        cy.visit("/trocas-e-devolucoes");
        cy.get('[data-cy="pagina-trocas"]')
            .should("contain", "Troca de tamanho:")
            .and("contain", "o frete é por conta do cliente")
            .and("contain", "Defeito ou peça errada:");
    });

    it("faixa do topo mostra um aviso da loja", () => {
        cy.visit("/");
        cy.get('[data-cy="avisos-loja"]').invoke("text").should("not.be.empty");
    });
});
