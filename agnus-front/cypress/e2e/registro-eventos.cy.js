// Tela "Registro de eventos" do admin (API simulada).
const admin = {
    onBeforeLoad(win) {
        win.localStorage.setItem("auth_token", "fake-admin-token");
        win.localStorage.setItem("auth", JSON.stringify({ id_usuario: 1, tipo: "administrador", user: { id_usuario: 1, tipo: "administrador" } }));
    },
};

const linha = (id, categoria, tipo, descricao, resultado = "sucesso", extra = {}) => ({
    id_registro: id, categoria, tipo, descricao, resultado, id_pedido: 21, id_usuario: 5, origem: "agnus-notificacoes",
    request_id: "req-1", dados: { assunto: descricao }, ocorrido_em: `2026-11-16T12:28:${String(10 + id).padStart(2, "0")}.000Z`, ...extra,
});

const REGISTRO = [
    linha(6, "email", "email.falhou", 'Falha ao enviar e-mail ao cliente (t****@example.com): "Seu pedido #21 saiu para entrega"', "falha"),
    linha(5, "pedido", "pedido.atualizado", "Pedido #21: pago → enviado"),
    linha(4, "email", "email.enviado", 'E-mail enviado ao cliente (t****@example.com): "Recebemos seu pagamento - pedido #21"'),
    linha(3, "pagamento", "pedido.atualizado", "Venda confirmada: pagamento do pedido #21 aprovado"),
    linha(2, "aviso", "aviso.site", 'Aviso no site ao cliente: "Pagamento confirmado"'),
    linha(1, "pedido", "pedido.criado", "Pedido #21 criado (R$ 69,90)"),
];

describe("Registro de eventos (admin)", () => {
    it("mostra a história do pedido, com filtros e detalhes", () => {
        cy.intercept("GET", "**/notifications/registro*", (req) => {
            const url = new URL(req.url);
            const categoria = url.searchParams.get("categoria");
            const data = categoria ? REGISTRO.filter((r) => r.categoria === categoria) : REGISTRO;
            req.reply({ body: { data, pagination: { page: 1, totalPages: 1, total: data.length, hasNextPage: false, hasPreviousPage: false } } });
        }).as("registro");

        cy.visit("/admin/eventos?pedido=21", admin);
        cy.wait("@registro").its("request.url").should("include", "id_pedido=21");
        cy.get('[data-cy="registro-pedido"]').should("have.value", "21");
        cy.get('[data-cy="registro-linha"]').should("have.length", 6);
        cy.get('[data-cy="tabela-registro"]').should("contain", "Venda confirmada").and("contain", "Falhou").and("contain", "E-mail");
        cy.wait(200);
        cy.screenshot("registro-eventos", { capture: "viewport" });

        cy.contains("button", "Detalhes").first().click();
        cy.contains("code", "email.falhou").scrollIntoView().should("be.visible");

        cy.get('[data-cy="registro-categoria"]').select("E-mail");
        cy.get('[data-cy="registro-filtrar"]').click();
        cy.wait("@registro").its("request.url").should("include", "categoria=email");
        cy.get('[data-cy="registro-linha"]').should("have.length", 2);
    });

    it("botão Histórico na lista de pedidos abre o registro do pedido", () => {
        cy.intercept("GET", /\/orders(\?.*)?$/, { body: [{ id_pedido: 21, id_usuario: 5, status: "enviado", valor_total: 69.9, data_criacao: "2026-11-16T12:00:00Z" }] });
        cy.intercept("GET", "**/notifications/registro*", { body: { data: REGISTRO, pagination: { page: 1, totalPages: 1, total: 6 } } }).as("registro");

        cy.visit("/admin/pedidos", admin);
        cy.get('[data-cy="historico-pedido"]').first().click();
        cy.location("pathname").should("eq", "/admin/eventos");
        cy.location("search").should("eq", "?pedido=21");
        cy.wait("@registro").its("request.url").should("include", "id_pedido=21");
    });
});
