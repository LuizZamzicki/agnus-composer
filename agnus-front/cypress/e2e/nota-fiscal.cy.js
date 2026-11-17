// NF-e do pedido: o cliente vê a nota em Meus pedidos; a equipe anexa no admin.
const CHAVE = "41241100000000000000550010000001231000000005";
const CHAVE_FORMATADA = "4124 1100 0000 0000 0000 5500 1000 0001 2310 0000 0005";

describe("Nota fiscal em Meus pedidos", () => {
    beforeEach(() => {
        localStorage.setItem("auth_token", "fake");
        localStorage.setItem("auth", JSON.stringify({ id_usuario: 1 }));
        cy.intercept("GET", "**/devolucoes/me", { body: [] });
        cy.intercept("GET", "**/notifications/me", { body: { data: [], naoLidas: 0 } });
        cy.intercept("GET", "**/order-items/*", { body: [] });
    });

    it("mostra número, chave para copiar, abre o PDF e baixa o XML com login", () => {
        cy.intercept("GET", "**/orders/me", {
            body: [{
                id_pedido: 81,
                id_usuario: 1,
                status: "entregue",
                valor_total: 159.8,
                nota_fiscal: { chave: CHAVE, chave_formatada: CHAVE_FORMATADA, numero: "123", serie: "1", data_emissao: "2026-11-17T13:30:00Z", valor: 159.8, tem_pdf: true, tem_xml: true },
            }],
        });
        cy.intercept("GET", "**/orders/81/nota-fiscal/pdf", { headers: { "content-type": "application/pdf" }, body: "%PDF-1.4" }).as("pdf");
        cy.intercept("GET", "**/orders/81/nota-fiscal/xml", {
            headers: { "content-type": "application/xml", "content-disposition": 'attachment; filename="NF-e-123-pedido-81.xml"' },
            body: "<nfeProc/>",
        }).as("xml");

        cy.visit("/cliente/pedidos", {
            onBeforeLoad(win) {
                cy.stub(win, "open").returns({ location: { href: "" }, close: () => {} }).as("abrirAba");
            },
        });
        cy.get('[data-cy="nota-fiscal"]').should("not.exist");
        cy.get('[data-cy="ver-nota-fiscal"]').click();
        cy.get('[data-cy="nota-fiscal"]').should("contain", "Nº 123 · série 1").and("contain", "17/11/2026");
        cy.get('[data-cy="nota-fiscal-chave"]').should("have.text", CHAVE_FORMATADA);

        cy.get('[data-cy="nota-fiscal-pdf"]').click();
        cy.wait("@pdf").its("request.headers.authorization").should("eq", "Bearer fake");
        cy.get("@abrirAba").should("have.been.calledWith", "", "_blank");

        cy.get('[data-cy="nota-fiscal-xml"]').click();
        cy.wait("@xml").its("request.headers.authorization").should("eq", "Bearer fake");
        cy.get('[data-cy="nota-fiscal"]').find('a[href*="nfe.fazenda.gov.br"]').should("have.attr", "target", "_blank");
    });

    it("pedido pago ainda sem nota mostra que está em emissão; aguardando pagamento não mostra nada", () => {
        cy.intercept("GET", "**/orders/me", {
            body: [
                { id_pedido: 82, id_usuario: 1, status: "pago", valor_total: 80, nota_fiscal: null },
                { id_pedido: 83, id_usuario: 1, status: "aguardando_pagamento", valor_total: 50, nota_fiscal: null },
            ],
        });
        cy.visit("/cliente/pedidos");
        cy.get('[data-cy="nota-fiscal-pendente"]').should("have.length", 1).and("contain", "Nota fiscal em emissão");
        cy.get('[data-cy="ver-nota-fiscal"]').should("not.exist");
    });
});

describe("Nota fiscal no admin", () => {
    const pedidos = (nota = null) => ({
        statusCode: 200,
        body: { data: [{ id_pedido: 9, cliente_nome: "Cliente NF", status: "pago", valor_total: 150, data_criacao: "2026-11-17", nota_fiscal: nota }] },
    });

    beforeEach(() => {
        cy.intercept("POST", "**/api/auth/login", {
            body: { token: "fake-admin-token", user: { id_usuario: 1, nome: "Administrador", email: "admin@email.com", tipo: "administrador" } },
        }).as("login");
        cy.visit("/login");
        cy.get('input[type="email"]').type("admin@email.com");
        cy.get('input[type="password"]').type("12345678");
        cy.get('button[type="submit"]').click();
        cy.wait("@login");
    });

    it("anexa o XML e o PDF; a etiqueta NF-e aparece no pedido", () => {
        cy.intercept("GET", "**/api/orders*", pedidos()).as("pedidos");
        cy.intercept("PUT", "**/api/notas-fiscais/9", {
            body: { chave: CHAVE, chave_formatada: CHAVE_FORMATADA, numero: "123", tem_pdf: true, tem_xml: true },
        }).as("salvar");
        cy.visit("/admin/pedidos");
        cy.wait("@pedidos");

        cy.get('[data-cy="pedido-nf"]').should("not.exist");
        cy.get('[data-cy="nota-fiscal-pedido"]').click();
        cy.get('[data-cy="modal-nota-fiscal"]').should("be.visible");
        cy.get('[data-cy="nota-fiscal-salvar"]').click();
        cy.get('[data-cy="nota-fiscal-erro"]').should("contain", "Anexe o PDF");

        cy.get('[data-cy="nota-fiscal-xml"]').selectFile({ contents: Cypress.Buffer.from("<nfeProc><NFe/></nfeProc>"), fileName: "nota.xml", mimeType: "text/xml" });
        cy.get('[data-cy="nota-fiscal-pdf"]').selectFile({ contents: Cypress.Buffer.from("%PDF-1.4"), fileName: "danfe.pdf", mimeType: "application/pdf" });
        cy.get('[data-cy="nota-fiscal-chave"]').should("not.exist");
        cy.get('[data-cy="nota-fiscal-salvar"]').click();

        cy.wait("@salvar").its("request.body").should((corpo) => {
            expect(atob(corpo.xml)).to.eq("<nfeProc><NFe/></nfeProc>");
            expect(atob(corpo.pdf)).to.eq("%PDF-1.4");
            expect(corpo).not.to.have.property("chave");
        });
        cy.get('[data-cy="modal-nota-fiscal"]').should("not.exist");
        cy.get('[data-cy="pedido-nf"]').should("contain", "NF-e nº 123");
    });

    it("mostra a nota já anexada e o erro do servidor", () => {
        cy.intercept("GET", "**/api/orders*", pedidos({ chave: CHAVE, chave_formatada: CHAVE_FORMATADA, numero: "123", tem_pdf: true, tem_xml: false })).as("pedidos");
        cy.intercept("PUT", "**/api/notas-fiscais/9", { statusCode: 400, body: { message: "Chave de acesso inválida: confira os 44 números." } });
        cy.visit("/admin/pedidos");
        cy.wait("@pedidos");
        cy.get('[data-cy="nota-fiscal-pedido"]').click();
        cy.get('[data-cy="nota-fiscal-atual"]').should("contain", "nº 123").and("contain", "PDF");
        cy.get('[data-cy="nota-fiscal-chave"]').type("1".repeat(44));
        cy.get('[data-cy="nota-fiscal-salvar"]').click();
        cy.get('[data-cy="nota-fiscal-erro"]').should("contain", "Chave de acesso inválida");
    });
});
