// Recursos para vender mais: ofertas por e-mail com cupom, escolher tamanho no card, etiquetas,
// contagem regressiva, barra do frete grátis, "Complete o look", cupom no checkout, WhatsApp
// flutuante, zoom e o link do e-mail de avaliação. Dados simulados com cy.intercept.
const DIA = 24 * 60 * 60 * 1000;

const produto = (id, extra = {}) => ({
    id_produto: id,
    id_categoria: 22,
    nome: `Peça ${id}`,
    preco_base: "100.00",
    preco_original: null,
    imagens: [],
    data_criacao: "2026-01-10T10:00:00Z",
    ...extra,
});

const catalogo = [produto(1), produto(2, { id_categoria: 23, nome: "Regata Fé" }), produto(3, { id_categoria: 24, nome: "Short Templo" })];

const vitrineVazia = () => {
    cy.intercept("GET", "**/api/products/catalog*", { body: { data: catalogo, pagination: { page: 1, totalPages: 1 } } });
    cy.intercept("GET", "**/api/products/best-sellers*", { body: { data: [] } });
    cy.intercept("GET", "**/api/categories*", { body: { data: [] } });
    cy.intercept("GET", "**/api/vitrine/categorias", { body: { data: [] } });
    cy.intercept("GET", "**/api/vitrine/banners", { body: { data: [] } });
    cy.intercept("GET", "**/api/product-reviews/destaques", { body: { data: [] } });
    cy.intercept("GET", "**/api/product-reviews/*", { body: [] });
};

describe("Ofertas por e-mail na página inicial", () => {
    beforeEach(vitrineVazia);

    it("e-mail inválido avisa sem chamar o servidor", () => {
        cy.intercept("POST", "**/api/ofertas", cy.spy().as("inscrever"));
        cy.visit("/");
        cy.get('[data-cy="ofertas-email-campo"]').scrollIntoView().type("sem-arroba");
        cy.get('[data-cy="ofertas-email-enviar"]').click();
        cy.get('[data-cy="ofertas-email-erro"]').should("contain", "e-mail válido");
        cy.get("@inscrever").should("not.have.been.called");
    });

    it("inscreve, mostra o cupom e já deixa ele guardado para o checkout", () => {
        cy.intercept("POST", "**/api/ofertas", { statusCode: 201, body: { cupom: "AGNUS10-ABCDEF", percentual: 10, ja_inscrito: false } }).as("inscrever");
        cy.visit("/");
        cy.contains("h2", "Ganhe 10% na primeira compra");
        cy.get('[data-cy="ofertas-email-campo"]').scrollIntoView().type("ana@exemplo.com");
        cy.get('[data-cy="ofertas-email-enviar"]').click();
        cy.wait("@inscrever").its("request.body").should("deep.equal", { email: "ana@exemplo.com" });
        cy.get('[data-cy="ofertas-cupom"]').should("have.text", "AGNUS10-ABCDEF");
        cy.window().its("localStorage").invoke("getItem", "agnus_cupom").should("eq", "AGNUS10-ABCDEF");
    });

    it("muitas tentativas seguidas: pede para esperar", () => {
        cy.intercept("POST", "**/api/ofertas", { statusCode: 429, body: "" });
        cy.visit("/");
        cy.get('[data-cy="ofertas-email-campo"]').scrollIntoView().type("ana@exemplo.com");
        cy.get('[data-cy="ofertas-email-enviar"]').click();
        cy.get('[data-cy="ofertas-email-erro"]').should("contain", "Espere um minuto");
    });

    it("link do e-mail cancela a inscrição", () => {
        cy.intercept("POST", "**/api/ofertas/cancelar", { body: { email: "a***@exemplo.com" } }).as("cancelar");
        cy.visit("/ofertas/cancelar?token=12345678-1234-1234-1234-123456789abc");
        cy.wait("@cancelar").its("request.body.token").should("eq", "12345678-1234-1234-1234-123456789abc");
        cy.contains("h1", "Inscrição cancelada");
        cy.contains("a***@exemplo.com não vai mais receber");
    });
});

describe("Cards da vitrine", () => {
    beforeEach(vitrineVazia);

    it("etiquetas Mais pedida e Novidade", () => {
        cy.intercept("GET", "**/api/products/best-sellers*", { body: { data: [produto(2)] } });
        cy.intercept("GET", "**/api/products/catalog*", {
            body: { data: [...catalogo, produto(5, { nome: "Lançamento", data_criacao: new Date(Date.now() - 2 * DIA).toISOString() })], pagination: { page: 1, totalPages: 1 } },
        });
        cy.visit("/catalogo");
        cy.get('[data-cy="produto-card-2"] [data-cy="etiquetas-produto"]').should("contain", "Mais pedida");
        cy.get('[data-cy="produto-card-5"] [data-cy="etiquetas-produto"]').should("contain", "Novidade");
        cy.get('[data-cy="produto-card-1"] [data-cy="etiquetas-produto"]').should("not.exist");
    });

    it("escolher tamanho no card coloca a peça na sacola sem sair da vitrine", () => {
        cy.intercept("GET", "**/api/product-colors/1", { body: [{ id_produto_cor: 11, nome: "Preto", acrescimo: 0 }] });
        cy.intercept("GET", "**/api/product-grades/1", { body: [{ id_produto_grade: 21, nome: "P", acrescimo: 0 }, { id_produto_grade: 22, nome: "M", acrescimo: 0 }] });
        cy.visit("/catalogo");
        cy.get('[data-cy="produto-card-1"]').parent().find('[data-cy="escolha-rapida-abrir"]').click({ force: true });
        cy.get('[data-cy="escolha-rapida-tamanho"]').contains("M").click();
        cy.get('[data-cy="escolha-rapida-ok"]').should("contain", "M · Preto").and("contain", "Ver sacola");
        cy.location("pathname").should("eq", "/catalogo");
        cy.window().then((win) => {
            const sacola = JSON.parse(win.localStorage.getItem("agnus_sacola_visitante"));
            expect(sacola).to.have.length(1);
            expect(sacola[0]).to.include({ id_produto: 1, id_produto_cor: 11, id_produto_grade: 22, quantidade: 1 });
        });
    });
});

describe("Contagem regressiva da campanha", () => {
    beforeEach(vitrineVazia);

    it("banner com fim próximo mostra a contagem; a faixa do topo também", () => {
        cy.clock(new Date("2026-11-25T12:00:00Z").getTime(), ["Date"]);
        cy.intercept("GET", "**/api/vitrine/banners", {
            body: { data: [{ id_banner: 1, titulo: "Vista a fé", sobretitulo: "Black Friday", imagem_url: "x.png", alinhamento: "esquerda", foco: "centro", fim: "2026-11-28T03:00:00Z" }] },
        });
        cy.visit("/");
        cy.get('[data-cy="banner-campanha"] [data-cy="contagem"]').should("have.attr", "aria-label", "Termina em 2d 15h 00min");
        cy.get('[data-cy="contagem-texto"]').should("contain", "Black Friday termina em 2d 15h");
    });

    it("sem data de fim, nada de contagem", () => {
        cy.intercept("GET", "**/api/vitrine/banners", {
            body: { data: [{ id_banner: 1, titulo: "Vista a fé", imagem_url: "x.png", alinhamento: "esquerda", foco: "centro", fim: null }] },
        });
        cy.visit("/");
        cy.get('[data-cy="banner-campanha"]').should("exist");
        cy.get('[data-cy="contagem"]').should("not.exist");
    });
});

const opcoesFrete = (gratis) => ({
    cep: "87000000",
    uf: "PR",
    frete_gratis: gratis,
    frete_gratis_acima: 250,
    origem: "tabela",
    opcoes: [
        { id: "pac", nome: "PAC", empresa: "Correios", preco: gratis ? 0 : 19.9, preco_cheio: 19.9, prazo_dias: 4, gratis },
        { id: "sedex", nome: "SEDEX", empresa: "Correios", preco: gratis ? 10 : 29.9, preco_cheio: 29.9, prazo_dias: 2, gratis: false },
    ],
});

describe("Sacola: frete grátis e Complete o look", () => {
    const visitarComSacola = (itens) =>
        cy.visit("/carrinho", {
            onBeforeLoad(win) {
                win.localStorage.setItem("agnus_sacola_visitante", JSON.stringify(itens));
            },
        });
    const item = (id, preco, quantidade = 1) => ({ id_carrinho_item: `v-${id}`, id_produto: id, id_produto_cor: id * 10, id_produto_grade: 1, quantidade, preco_unitario: preco, nome_produto: `Peça ${id}`, nome_cor: "Preto", nome_tamanho: "M" });

    beforeEach(vitrineVazia);

    it("mostra quanto falta para o frete grátis e sugere peças de outras categorias", () => {
        visitarComSacola([item(1, 100)]);
        cy.get('[data-cy="barra-frete"]').should("contain", "Faltam").invoke("text").should("match", /R\$\s150,00/);
        cy.get('[data-cy="carrinho-frete"]').should("contain", "informe o CEP");
        cy.get('[data-cy="sugestao-look"]').should("have.length", 2).first().should("contain", "Regata Fé");
        cy.get('[data-cy="complete-look"]').should("not.contain", "Peça 1");
    });

    it("a partir de R$ 250 o envio mais econômico sai grátis", () => {
        cy.intercept("POST", "**/frete/cotacao", { body: opcoesFrete(true) }).as("cotacao");
        visitarComSacola([item(1, 130, 2)]);
        cy.get('[data-cy="barra-frete"]').should("contain", "Frete grátis garantido");
        cy.get('[data-cy="frete-cep"]').type("87000-000");
        cy.get('[data-cy="frete-calcular"]').click();
        cy.wait("@cotacao").its("request.body").should("deep.equal", { cep: "87000000", pecas: 2, valor_pecas: 260 });
        cy.get('[data-cy="carrinho-frete"]').should("contain", "Grátis");
        cy.get('[data-cy="carrinho-total"]').invoke("text").should("match", /R\$\s260,00/);
    });

    it("calcula o frete pelo CEP, guarda o CEP e soma a opção escolhida no total", () => {
        cy.intercept("POST", "**/frete/cotacao", { body: opcoesFrete(false) }).as("cotacao");
        visitarComSacola([item(1, 100)]);
        cy.get('[data-cy="frete-cep"]').type("123");
        cy.get('[data-cy="frete-calcular"]').click();
        cy.get('[data-cy="frete-erro"]').should("contain", "8 números");
        cy.get('[data-cy="frete-cep"]').clear().type("87000000").should("have.value", "87000-000");
        cy.get('[data-cy="frete-calcular"]').click();
        cy.wait("@cotacao");
        cy.get('[data-cy="frete-opcao"]').should("have.length", 2).first().should("contain", "PAC").and("contain", "até 4 dias úteis");
        cy.get('[data-cy="carrinho-total"]').invoke("text").should("match", /R\$\s119,90/);
        cy.get('[data-cy="frete-opcao"][data-id="sedex"] input').check();
        cy.get('[data-cy="carrinho-frete"]').invoke("text").should("match", /29,90/);
        cy.get('[data-cy="carrinho-total"]').invoke("text").should("match", /R\$\s129,90/);
        cy.window().its("localStorage").invoke("getItem", "agnus_cep").should("eq", "87000000");
    });
});

describe("Cupom no Finalizar pedido", () => {
    beforeEach(() => {
        cy.intercept("GET", "**/notifications/me", { body: { data: [], naoLidas: 0 } });
        cy.intercept("GET", "**/carts?id_usuario=1", { body: [{ id_carrinho: 1 }] });
        cy.intercept("GET", "**/cart-items/1", {
            body: [{ id_carrinho_item: 10, quantidade: 2, preco_unitario: 140, produto: { nome: "Camiseta" }, cor: { nome: "Preto" }, grade: { nome: "M" } }],
        });
        cy.intercept("GET", "**/user-addresses/1", {
            body: [{ id_usuario_endereco: 5, logradouro: "Rua A", numero: "1", bairro: "Centro", cidade: "Maringá", estado: "PR", cep: "87000000", principal: true }],
        });
        cy.intercept("POST", "**/frete/cotacao", (req) => req.reply({ body: opcoesFrete(req.body.valor_pecas >= 250) })).as("cotacao");
    });

    const visitar = (cupomGuardado) =>
        cy.visit("/finalizar", {
            onBeforeLoad(win) {
                win.localStorage.setItem("auth_token", "fake-token");
                win.localStorage.setItem("auth", JSON.stringify({ id_usuario: 1, tipo: "cliente" }));
                if (cupomGuardado) win.localStorage.setItem("agnus_cupom", cupomGuardado);
            },
        });

    it("cupom guardado vem preenchido; aplicado, dá 10% e o pedido leva o código", () => {
        cy.intercept("GET", "**/cupons/AGNUS10-ABCDEF", { body: { codigo: "AGNUS10-ABCDEF", percentual: 10 } });
        cy.intercept("POST", "**/orders/checkout", { statusCode: 201, body: { id_pedido: 77 } }).as("checkout");
        cy.intercept("GET", "**/orders/77**", { body: { id_pedido: 77, status: "aguardando_pagamento", valor_total: 252 } });
        visitar("AGNUS10-ABCDEF");
        cy.get('[data-cy="finalizar-frete"]').should("have.text", "Grátis");
        cy.get('[data-cy="cupom-codigo"]').should("have.value", "AGNUS10-ABCDEF");
        cy.get('[data-cy="aplicar-cupom"]').click();
        cy.get('[data-cy="cupom-aplicado"]').should("contain", "AGNUS10-ABCDEF");
        cy.get('[data-cy="finalizar-desconto"]').invoke("text").should("match", /28,00/);
        cy.get('[data-cy="finalizar-total"]').invoke("text").should("match", /R\$\s252,00/);
        cy.get('[data-cy="finalizar-frete"]').should("have.text", "Grátis");
        cy.get('[data-cy="confirmar-pedido"]').click();
        cy.wait("@checkout").its("request.body").should("deep.equal", { id_usuario_endereco: 5, frete_servico: "pac", cupom: "AGNUS10-ABCDEF" });
        cy.window().its("localStorage").invoke("getItem", "agnus_cupom").should("be.null");
    });

    it("cupom recusado mostra o motivo e o pedido segue sem desconto", () => {
        cy.intercept("GET", "**/cupons/*", { statusCode: 409, body: { message: "Este cupom vale só para a primeira compra." } });
        visitar();
        cy.get('[data-cy="cupom-codigo"]').type("agnus10-zzzzzz");
        cy.get('[data-cy="aplicar-cupom"]').click();
        cy.get('[data-cy="cupom-erro"]').should("contain", "só para a primeira compra");
        cy.get('[data-cy="finalizar-desconto"]').should("not.exist");
        cy.get('[data-cy="finalizar-total"]').invoke("text").should("match", /R\$\s280,00/);
    });

    it("frete cotado pelo CEP do endereço: a opção escolhida vai no pedido e entra no total", () => {
        cy.intercept("GET", "**/cart-items/1", {
            body: [{ id_carrinho_item: 10, quantidade: 1, preco_unitario: 100, produto: { nome: "Camiseta" }, cor: { nome: "Preto" }, grade: { nome: "M" } }],
        });
        cy.intercept("POST", "**/orders/checkout", { statusCode: 201, body: { id_pedido: 78 } }).as("checkout");
        cy.intercept("GET", "**/orders/78**", { body: { id_pedido: 78, status: "aguardando_pagamento", valor_total: 100, valor_frete: 29.9 } });
        visitar();
        cy.wait("@cotacao").its("request.body").should("deep.equal", { cep: "87000000", pecas: 1, valor_pecas: 100 });
        cy.get('[data-cy="calculo-frete"]').should("contain", "CEP 87000-000");
        cy.get('[data-cy="finalizar-frete"]').invoke("text").should("match", /19,90/);
        cy.get('[data-cy="frete-opcao"][data-id="sedex"] input').check();
        cy.get('[data-cy="finalizar-total"]').invoke("text").should("match", /R\$\s129,90/);
        cy.get('[data-cy="confirmar-pedido"]').click();
        cy.wait("@checkout").its("request.body").should("deep.equal", { id_usuario_endereco: 5, frete_servico: "sedex" });
    });
});

describe("WhatsApp flutuante, zoom e link de avaliação", () => {
    beforeEach(vitrineVazia);

    it("aparece na loja com o link da peça e some no login", () => {
        cy.intercept("GET", "**/api/products/4", { body: { id_produto: 4, id_categoria: 23, nome: "Tank Top", descricao: "Regata.", preco_base: "64.90" } });
        cy.intercept("GET", "**/api/categories/23", { body: { id_categoria: 23, nome: "Regatas" } });
        cy.intercept("GET", "**/api/product-photos/4", { body: [] });
        cy.intercept("GET", "**/api/product-colors/4", { body: [{ id_produto_cor: 1, nome: "Preto" }] });
        cy.intercept("GET", "**/api/product-grades/4", { body: [{ id_produto_grade: 1, nome: "M" }] });
        cy.visit("/");
        cy.get('[data-cy="whatsapp-flutuante"]').should("have.attr", "href").and("include", "wa.me/5544991389614");
        cy.visit("/produto/4?avaliar=1");
        cy.get('[data-cy="whatsapp-flutuante"]').should("have.attr", "href").and("include", encodeURIComponent("/produto/4"));
        cy.get('[data-cy="entrar-para-avaliar"]').should("have.attr", "href", `/login?redirect=${encodeURIComponent("/produto/4?avaliar=1")}`);
        cy.visit("/login");
        cy.get('[data-cy="whatsapp-flutuante"]').should("not.exist");
    });
});
