// Telas do programa de afiliados (cliente e admin), devolução e exclusão de categoria.
// A API é simulada (cy.intercept): o teste confere o que a tela mostra e o que ela envia.

const cliente = () => ({
    onBeforeLoad(win) {
        win.localStorage.setItem("auth_token", "fake-token");
        win.localStorage.setItem("auth", JSON.stringify({ id_usuario: 5, tipo: "cliente", user: { id_usuario: 5, tipo: "cliente" } }));
    },
});

const admin = () => ({
    onBeforeLoad(win) {
        win.localStorage.setItem("auth_token", "fake-admin-token");
        win.localStorage.setItem("auth", JSON.stringify({ id_usuario: 1, tipo: "administrador", user: { id_usuario: 1, tipo: "administrador" } }));
    },
});

const resumo = {
    cliques_30_dias: 42,
    comissao: {
        aguardando_pagamento_do_pedido: { quantidade: 0, comissao: 0 },
        pendente: { quantidade: 1, comissao: 13.98 },
        a_receber: { quantidade: 2, comissao: 20.97 },
        recebida: { quantidade: 1, comissao: 10 },
        cancelada: { quantidade: 0, comissao: 0 },
    },
};

const afiliadoAtivo = {
    id_afiliado: 3, codigo: "abc123", nome_publico: "@perfilteste", canal: null, chave_pix: "pix@teste.com",
    status: "ativo", taxa_personalizada: null, app_id: null, tem_credencial_api: false, resumo,
};

beforeEach(() => {
    cy.intercept("GET", "**/notifications/me", { body: { data: [], naoLidas: 0 } });
    cy.intercept("GET", "**/carts/user/**", { body: [] });
});

describe("Programa de afiliados (cliente)", () => {
    it("quem não é afiliado vê a inscrição; o botão só libera com os termos aceitos", () => {
        let inscrito = false;
        cy.intercept("GET", "**/afiliados/me", (req) =>
            req.reply(inscrito ? { body: { ...afiliadoAtivo, status: "pendente" } } : { statusCode: 404, body: { message: "Você ainda não faz parte do programa de afiliados." } }),
        );
        cy.intercept("POST", "**/afiliados/inscricao", (req) => {
            inscrito = true;
            req.reply({ statusCode: 201, body: { ...afiliadoAtivo, status: "pendente" } });
        }).as("inscricao");

        cy.visit("/cliente/afiliados", cliente());
        cy.get('[data-cy="afiliados-inscricao"]').should("be.visible");
        cy.get('[data-cy="afi-nome"]').type("@perfilteste");
        cy.get('[data-cy="afi-inscrever"]').should("be.disabled");
        cy.get('[data-cy="afi-termos"]').check();
        cy.get('[data-cy="afi-pix"]').type("pix@teste.com");
        cy.get('[data-cy="afi-inscrever"]').should("not.be.disabled").click();

        cy.wait("@inscricao").its("request.body").should("deep.include", { nome_publico: "@perfilteste", chave_pix: "pix@teste.com", aceite_termos: true });
        cy.get('[data-cy="afi-pendente"]').should("contain", "analisando");
    });

    it("afiliado aprovado vê resumo, produtos com comissão, gera link e vê as vendas", () => {
        cy.intercept("GET", "**/afiliados/me", { body: afiliadoAtivo });
        cy.intercept("GET", "**/afiliados/me/pagamentos*", { body: { data: [{ id_pagamento: 1, valor: 10, quantidade_conversoes: 1, data_criacao: "2026-11-01T12:00:00Z" }] } });
        cy.intercept("GET", "**/afiliados/v1/ofertas*", {
            body: {
                data: [{ id_produto: 1, nome: "Camiseta DryFit Basic Masculina", preco: 69.9, taxa_comissao: 15, comissao_estimada: 10.49, imagem: null, link_afiliado: "https://localhost/l/k7m2pq9x" }],
                pagination: { total: 1 },
            },
        });
        cy.intercept("GET", "**/afiliados/v1/conversoes*", {
            body: {
                data: [{
                    id_conversao: 9, id_pedido: 40, status: "pendente", data_pedido: "2026-11-10T12:00:00Z", liberada_em: "2026-11-27T12:00:00Z",
                    valor_comissionavel: 139.8, valor_comissao: 20.97, link: { sub_ids: ["instagram"] },
                    itens: [{ quantidade: 2, nome_produto: "Camiseta DryFit Basic Masculina" }],
                }],
            },
        });
        cy.intercept("POST", "**/afiliados/v1/links", { statusCode: 201, body: { slug: "z2b28qw4", link_curto: "https://localhost/l/z2b28qw4", sub_ids: ["story"] } }).as("link");

        cy.visit("/cliente/afiliados", cliente());
        cy.get('[data-cy="afi-resumo"]').should("contain", "42").and("contain", "20,97");
        cy.get('[data-cy="afi-ofertas"]').should("contain", "Camiseta DryFit Basic Masculina").and("contain", "15%").and("contain", "10,49");
        cy.get('[data-cy="afi-vendas"]').should("contain", "instagram").and("contain", "20,97").and("contain", "Pendente");

        cy.get('[data-cy="afi-url"]').type("/produto/1");
        cy.get('[data-cy="afi-subid"]').type("story");
        cy.get('[data-cy="afi-gerar"]').click();
        cy.wait("@link").its("request.body").should("deep.equal", { url: "/produto/1", sub_ids: ["story"] });
        cy.get('[data-cy="afi-link-gerado"]').should("contain", "https://localhost/l/z2b28qw4");
    });

    it("termos do programa abrem para qualquer pessoa", () => {
        cy.visit("/afiliados/termos");
        cy.contains("h1", "Termos do Programa de Afiliados").should("be.visible");
        cy.contains("7 dias").should("be.visible");
    });
});

describe("Devolução em Meus pedidos", () => {
    it("pedido entregue: escolhe a peça, o motivo, envia e acompanha", () => {
        let devolucoes = [];
        cy.intercept("GET", "**/orders/me*", { body: [{ id_pedido: 40, status: "entregue", valor_total: 139.8, data_criacao: "2026-11-01T12:00:00Z" }] });
        cy.intercept("GET", "**/order-items/40", { body: [{ id_pedido_item: 7, quantidade: 2, subtotal: 139.8, produto: { id_produto: 1, nome: "Camiseta DryFit Basic Masculina" }, cor: { nome: "Preto" }, grade: { nome: "M" } }] });
        cy.intercept("GET", "**/product-reviews/**", { body: [] });
        cy.intercept("GET", "**/devolucoes/me", (req) => req.reply({ body: devolucoes }));
        cy.intercept("GET", "**/orders/40/devolucao/opcoes", {
            body: {
                elegivel: true,
                motivos: [
                    { valor: "arrependimento", rotulo: "Desisti da compra", prazo_dias: 7, disponivel: true, disponivel_ate: "2026-11-18T12:00:00Z" },
                    { valor: "defeito", rotulo: "A peça veio com defeito", prazo_dias: 90, disponivel: true, disponivel_ate: "2027-02-09T12:00:00Z" },
                ],
                itens: [{ id_pedido_item: 7, nome_produto: "Camiseta DryFit Basic Masculina", cor: "Preto", tamanho: "M", preco_unitario: 69.9, quantidade_comprada: 2, quantidade_devolvivel: 2 }],
            },
        });
        cy.intercept("POST", "**/orders/40/devolucoes", (req) => {
            devolucoes = [{
                id_devolucao: 3, id_pedido: 40, status: "solicitada", status_rotulo: "Em análise", motivo: "defeito", motivo_rotulo: "A peça veio com defeito",
                valor_reembolso: 69.9, data_solicitacao: "2026-11-14T12:00:00Z", itens: [{ id_pedido_item: 7, quantidade: 1, nome_produto: "Camiseta DryFit Basic Masculina", tamanho: "M" }],
                fotos: [],
            }];
            req.reply({ statusCode: 201, body: devolucoes[0] });
        }).as("devolver");
        cy.intercept("POST", "**/devolucao-fotos/3", (req) => {
            devolucoes[0].fotos.push({ id_devolucao_foto: devolucoes[0].fotos.length + 1, url: `/api/devolucao-fotos/${devolucoes[0].fotos.length + 1}` });
            req.reply({ statusCode: 201, body: devolucoes[0] });
        }).as("foto");
        // A foto exige login: a tela baixa com o token (não é <img src> direto na API).
        cy.intercept("GET", "**/devolucao-fotos/*", (req) => {
            expect(req.headers.authorization).to.eq("Bearer fake-token");
            req.reply({ fixture: "imagem-teste.png,binary", headers: { "content-type": "image/webp" } });
        }).as("verFoto");

        cy.visit("/cliente/pedidos", cliente());
        cy.get('[data-cy="pedir-devolucao"]').click();
        cy.get('[data-cy="devolucao-item"]').check();
        cy.get('[data-cy="devolucao-total"]').should("contain", "69,90");
        cy.get('[data-cy="motivo-defeito"]').check();
        cy.get('[data-cy="enviar-devolucao"]').should("be.disabled");
        cy.get('[data-cy="devolucao-descricao"]').type("A costura da manga abriu.");
        cy.get('[data-cy="devolucao-fotos-input"]').selectFile("cypress/fixtures/imagem-teste.png", { force: true });
        cy.get(".devolucao-foto-previa img").should("have.length", 1).and("have.attr", "src").and("match", /^data:image\/jpeg;base64,/);
        cy.get('[data-cy="enviar-devolucao"]').should("not.be.disabled").click();

        cy.wait("@devolver").its("request.body").should("deep.equal", {
            motivo: "defeito",
            descricao: "A costura da manga abriu.",
            itens: [{ id_pedido_item: 7, quantidade: 1 }],
        });
        // A foto sobe depois que a devolução existe, já reduzida para JPEG no navegador.
        cy.wait("@foto").its("request.body.foto").should("match", /^data:image\/jpeg;base64,/);
        cy.wait("@verFoto");
        cy.get('[data-cy="devolucao-fotos"] img').should("have.length", 1).and("have.attr", "src").and("match", /^blob:/);
        cy.get('[data-cy="devolucao-status"]').should("contain", "Em análise");
        cy.get('[data-cy="cancelar-devolucao"]').should("be.visible");
        cy.get('[data-cy="pedir-devolucao"]').should("not.exist");
    });
});

describe("Admin", () => {
    it("aprova afiliado e registra pagamento", () => {
        cy.intercept("GET", "**/afiliados/admin/afiliados*", {
            body: { data: [{ id_afiliado: 3, codigo: "abc123", id_usuario: 9, nome_publico: "@perfilteste", chave_pix: "pix@teste.com", status: "pendente", taxa_personalizada: null, saldo: { a_receber: 0 } }] },
        });
        cy.intercept("PATCH", "**/afiliados/admin/afiliados/3", { body: { ...afiliadoAtivo } }).as("aprovar");
        cy.intercept("GET", "**/afiliados/admin/saldos", { body: { total_a_pagar: 20.97, data: [{ id_afiliado: 3, nome_publico: "@perfilteste", chave_pix: "pix@teste.com", a_receber: 20.97, conversoes: 1 }] } });
        cy.intercept("POST", "**/afiliados/admin/afiliados/3/pagamentos", { statusCode: 201, body: { id_pagamento: 1, valor: 20.97 } }).as("pagar");

        cy.visit("/admin/afiliados", admin());
        cy.get('[data-cy="tabela-afiliados"]').should("contain", "@perfilteste");
        cy.get('[data-cy="aprovar-afiliado"]').click();
        cy.get(".app-confirm-modal").contains("button", /^Aprovar$/).click();
        cy.wait("@aprovar").its("request.body").should("deep.equal", { status: "ativo" });

        cy.get('[data-cy="aba-saldos"]').click();
        cy.get('[data-cy="tabela-saldos"]').should("contain", "20,97");
        cy.get('[data-cy="pagar-afiliado"]').click();
        cy.get('[data-cy="pagamento-referencia"]').type("PIX-123");
        cy.get('[data-cy="confirmar-pagamento"]').click();
        cy.wait("@pagar").its("request.body").should("deep.equal", { referencia: "PIX-123" });
    });

    it("cria regra de comissão por categoria", () => {
        cy.intercept("GET", "**/afiliados/admin/regras", { body: { taxa_padrao_em_uso: 10, data: [] } });
        cy.intercept("GET", "**/afiliados/admin/afiliados*", { body: { data: [] } });
        cy.intercept("GET", "**/categories*", { body: { data: [{ id_categoria: 22, nome: "Camisetas" }] } });
        cy.intercept("GET", /\/products(\?.*)?$/, { body: { data: [] } });
        cy.intercept("PUT", "**/afiliados/admin/regras", { body: { id_regra: 1 } }).as("regra");

        cy.visit("/admin/afiliados", admin());
        cy.get('[data-cy="aba-regras"]').click();
        cy.get('[data-cy="regra-referencia"]').select("Camisetas");
        cy.get('[data-cy="regra-taxa"]').type("12");
        cy.get('[data-cy="salvar-regra"]').click();
        cy.wait("@regra").its("request.body").should("deep.equal", { tipo: "categoria", referencia_id: 22, taxa: 12 });
    });

    it("aprova devolução com instruções e código de postagem", () => {
        cy.intercept("GET", "**/devolucoes?*", {
            body: {
                data: [{ id_devolucao: 3, id_pedido: 40, id_usuario: 5, status: "solicitada", status_rotulo: "Em análise", motivo_rotulo: "A peça veio com defeito", descricao: "Costura abriu", valor_reembolso: 69.9, data_solicitacao: "2026-11-14T12:00:00Z", itens: [{ id_pedido_item: 7, quantidade: 1, nome_produto: "Camiseta", tamanho: "M" }], fotos: [{ id_devolucao_foto: 1, url: "/api/devolucao-fotos/1" }, { id_devolucao_foto: 2, url: "/api/devolucao-fotos/2" }] }],
                pagination: { page: 1, totalPages: 1, total: 1 },
            },
        });
        cy.intercept("POST", "**/devolucoes/3/aprovar", { body: { status: "aprovada", status_rotulo: "Aprovada" } }).as("aprovar");

        cy.intercept("GET", "**/devolucao-fotos/*", (req) => {
            expect(req.headers.authorization).to.eq("Bearer fake-admin-token");
            req.reply({ fixture: "imagem-teste.png,binary", headers: { "content-type": "image/webp" } });
        });

        cy.visit("/admin/devolucoes", admin());
        cy.get('[data-cy="tabela-devolucoes"]').should("contain", "Costura abriu").and("contain", "69,90");
        cy.get('[data-cy="devolucao-foto-admin"] img').should("have.length", 2).first().should("have.attr", "src").and("match", /^blob:/);
        cy.get('[data-cy="aprovar-devolucao"]').click();
        cy.get('[data-cy="devolucao-codigo"]').type("AP123456BR");
        cy.get('[data-cy="devolucao-confirmar"]').click();
        cy.wait("@aprovar").its("request.body").should("have.property", "codigo_postagem", "AP123456BR");
    });

    it("exclui categoria com produtos só depois da segunda confirmação", () => {
        let chamadas = 0;
        cy.intercept("GET", "**/categories*", { body: { data: [{ id_categoria: 22, nome: "Camisetas" }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } });
        cy.intercept("DELETE", "**/categories/22*", (req) => {
            chamadas += 1;
            req.reply(req.url.includes("mover_produtos=true") ? { statusCode: 204 } : { statusCode: 409, body: { message: "tem produtos", produtos: 7 } });
        }).as("excluir");

        cy.visit("/admin/categorias", admin());
        cy.get('[data-cy="categoria-excluir-22"]').click();
        cy.get(".app-confirm-modal").contains("button", /^Excluir$/).click();
        cy.wait("@excluir");
        cy.contains("7 produto(s)").should("be.visible");
        cy.get(".app-confirm-modal").contains("button", "Excluir e manter os produtos").click();
        cy.wait("@excluir").its("request.url").should("include", "mover_produtos=true").then(() => expect(chamadas).to.eq(2));
    });

    it("edita o nome da categoria e mostra o erro de nome repetido", () => {
        cy.intercept("GET", "**/categories*", { body: { data: [{ id_categoria: 22, nome: "camisetas" }, { id_categoria: 23, nome: "Regatas" }], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } } });
        cy.intercept("PUT", "**/categories/22", (req) =>
            req.reply(req.body.nome === "Regatas" ? { statusCode: 400, body: { message: "Já existe categoria com esse nome." } } : { body: { id_categoria: 22, nome: req.body.nome } }),
        ).as("editar");

        cy.visit("/admin/categorias", admin());
        cy.get('[data-cy="categoria-editar-22"]').click();
        cy.contains("h2", "Editar Categoria").should("be.visible");
        cy.get('[data-cy="input-nome-categoria"]').should("have.value", "camisetas").clear().type("Regatas");
        cy.get('[data-cy="btn-salvar-categoria"]').click();
        cy.wait("@editar");
        cy.contains("Já existe categoria com esse nome.").should("be.visible");

        cy.get('[data-cy="input-nome-categoria"]').clear().type("Camisetas{enter}");
        cy.wait("@editar").its("request.body").should("deep.equal", { nome: "Camisetas" });
        cy.get('[data-cy="tabela-categorias"]').should("contain", "Camisetas").and("not.contain", "camisetas");
        cy.contains("h2", "Editar Categoria").should("not.exist");

        // O aviso de sucesso fica por cima do botão até sumir sozinho.
        cy.contains("strong", "Sucesso", { timeout: 10000 }).should("not.exist");
        cy.get('[data-cy="btn-nova-categoria"]').click();
        cy.contains("h2", "Nova Categoria").should("be.visible");
        cy.get('[data-cy="input-nome-categoria"]').should("have.value", "");
    });
});
