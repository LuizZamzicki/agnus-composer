// Integração YouDraw no admin: SKUs por cor/tamanho no produto e a coluna YouDraw na lista de pedidos.
// Tudo simulado com cy.intercept: nenhum teste fala com a YouDraw.
describe("Admin YouDraw", () => {
    function visitar(caminho) {
        cy.visit(caminho, {
            onBeforeLoad(win) {
                win.localStorage.setItem("auth_token", "fake-admin-token");
                win.localStorage.setItem(
                    "auth",
                    JSON.stringify({ user: { id_usuario: 1, nome: "Administrador", email: "admin@email.com", tipo: "administrador" } })
                );
            }
        });
    }

    const combinacoes = (skuM = null) => [
        { cor: "Preto", tamanho: "M", sku: skuM, id_produto_fornecedor: null },
        { cor: "Preto", tamanho: "G", sku: null, id_produto_fornecedor: null }
    ];

    describe("SKUs no cadastro do produto", () => {
        beforeEach(() => {
            cy.intercept("GET", "**/categories*", { body: [{ id_categoria: 1, nome: "Camisetas" }] });
            cy.intercept("GET", "**/products/1", {
                body: { id_produto: 1, nome: "Camiseta DryFit Basic Masculina", descricao: "Teste", custo: 30, preco_base: 79.9, id_categoria: 1, ativo: true }
            });
            cy.intercept("GET", "**/product-grades/1", { body: [{ id_produto_grade: 20, nome: "M" }, { id_produto_grade: 21, nome: "G" }] });
            cy.intercept("GET", "**/product-colors/1", { body: [{ id_produto_cor: 10, nome: "Preto", hex: "#000000" }] });
            cy.intercept("GET", "**/product-photos/1", { body: [] });
        });

        it("integração ligada: busca na YouDraw e salva os SKUs", () => {
            cy.intercept("GET", "**/products/1/skus", { body: { combinacoes: combinacoes(), faltando: 2, integracao_ativa: true } });
            cy.intercept("POST", "**/products/1/skus/importar", {
                body: {
                    associados: 1,
                    sem_par: [{ cor: "Preto", tamanho: "G" }],
                    produto_youdraw: { id: "yd_p1", nome: "Camiseta DryFit Basic Masculina" },
                    resumo: { combinacoes: combinacoes("YD-PRETO-M"), faltando: 1, integracao_ativa: true }
                }
            }).as("importar");
            cy.intercept("PUT", "**/products/1/skus", (req) => {
                req.reply({ body: { combinacoes: req.body.skus.map((s) => ({ ...s, sku: s.sku || null })), faltando: 0, integracao_ativa: true } });
            }).as("salvar");

            visitar("/admin/produtos/editar/1");

            cy.get('[data-cy="skus-youdraw"]').scrollIntoView().should("contain", "Faltam 2");
            cy.get('[data-cy="buscar-skus"]').click();
            cy.wait("@importar");
            cy.get('[data-cy="sku-Preto-M"]').should("have.value", "YD-PRETO-M");

            cy.get('[data-cy="sku-Preto-G"]').type("YD-PRETO-G");
            cy.get('[data-cy="salvar-skus"]').click();
            cy.wait("@salvar").its("request.body.skus").should("deep.include", { cor: "Preto", tamanho: "G", sku: "YD-PRETO-G" });
        });

        it("nome ambíguo: mostra os candidatos e busca o escolhido", () => {
            cy.intercept("GET", "**/products/1/skus", { body: { combinacoes: combinacoes(), faltando: 2, integracao_ativa: true } });
            cy.intercept("POST", "**/products/1/skus/importar", (req) => {
                if (!req.body.id_produto_fornecedor) {
                    req.reply({ body: { precisa_escolher: true, mensagem: "Escolha o produto", candidatos: [{ id: "yd_a", nome: "Camiseta A" }, { id: "yd_b", nome: "Camiseta B" }] } });
                } else {
                    req.reply({ body: { associados: 2, sem_par: [], produto_youdraw: { id: req.body.id_produto_fornecedor, nome: "Camiseta B" }, resumo: { combinacoes: combinacoes("B-M"), faltando: 1, integracao_ativa: true } } });
                }
            }).as("importar");

            visitar("/admin/produtos/editar/1");
            cy.get('[data-cy="buscar-skus"]').scrollIntoView().click();
            cy.wait("@importar");
            cy.get('[data-cy="candidato-youdraw"]').select("yd_b");
            cy.wait("@importar").its("request.body").should("deep.equal", { id_produto_fornecedor: "yd_b" });
            cy.get('[data-cy="sku-Preto-M"]').should("have.value", "B-M");
        });

        it("integração desligada: avisa e não deixa buscar", () => {
            cy.intercept("GET", "**/products/1/skus", { body: { combinacoes: combinacoes(), faltando: 2, integracao_ativa: false } });
            visitar("/admin/produtos/editar/1");
            cy.get('[data-cy="youdraw-desligada"]').scrollIntoView().should("be.visible");
            cy.get('[data-cy="buscar-skus"]').should("be.disabled");
        });
    });

    describe("Coluna YouDraw nos pedidos", () => {
        const pedido = (extra) => ({ id_pedido: 7, cliente_nome: "Cliente YouDraw", status: "pago", valor_total: 139.8, data_criacao: "2026-11-16", ...extra });
        const lista = (itens) => ({
            body: { data: itens, pagination: { page: 1, totalPages: 1, total: itens.length, hasNextPage: false, hasPreviousPage: false } }
        });

        it("pedido pago sem envio: botão Enviar cria na YouDraw e mostra o código", () => {
            cy.intercept("GET", "**/api/orders*", lista([pedido({ fornecedor: null })])).as("pedidos");
            cy.intercept("POST", "**/orders/7/fornecedor/enviar", {
                body: { fornecedor: { situacao: "enviado", codigo_publico: "YD-ABC23", status_externo: "pending_payment" } }
            }).as("enviar");

            visitar("/admin/pedidos");
            cy.wait("@pedidos");
            cy.get('[data-cy="enviar-youdraw"]').click();
            cy.wait("@enviar").its("request.body").should("deep.equal", {});
            cy.get('[data-cy="youdraw-enviado"]').should("contain", "YD-ABC23").and("contain", "aguardando pagamento lá");
        });

        it("pedido não pago: sem botão", () => {
            cy.intercept("GET", "**/api/orders*", lista([pedido({ status: "pendente", fornecedor: null })])).as("pedidos");
            visitar("/admin/pedidos");
            cy.wait("@pedidos");
            cy.get('[data-cy="pedido-row"]').should("exist");
            cy.get('[data-cy="enviar-youdraw"]').should("not.exist");
        });

        it("conflito de idempotência: só manda chave nova depois de confirmar", () => {
            cy.intercept("GET", "**/api/orders*", lista([pedido({ fornecedor: { situacao: "erro", erro: "falhou", retentavel: false } })])).as("pedidos");
            let chamadas = 0;
            cy.intercept("POST", "**/orders/7/fornecedor/enviar", (req) => {
                chamadas += 1;
                req.reply({
                    body: req.body.nova_chave
                        ? { fornecedor: { situacao: "enviado", codigo_publico: "YD-NOVO1", status_externo: "pending_payment" } }
                        : { fornecedor: { situacao: "erro", erro_codigo: "idempotency_conflict", erro: "conflito" } }
                });
            }).as("enviar");

            visitar("/admin/pedidos");
            cy.wait("@pedidos");
            cy.on("window:confirm", () => true);
            cy.get('[data-cy="youdraw-erro"]').find('[data-cy="enviar-youdraw"]').click();
            cy.wait("@enviar");
            cy.wait("@enviar").its("request.body").should("deep.equal", { nova_chave: true });
            cy.get('[data-cy="youdraw-enviado"]').should("contain", "YD-NOVO1").then(() => expect(chamadas).to.eq(2));
        });
    });
});
