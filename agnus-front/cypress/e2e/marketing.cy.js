// Marketing e conversão (AGNUS-242): aviso de cookies e pixels, preço no Pix, descadastro do
// lembrete de sacola e, sem simulação, o catálogo para anúncios, o sitemap, o robots e a prévia de
// link que o gateway entrega aos robôs de rede social.

const vitrineVazia = () => {
    cy.intercept("GET", "**/api/products/catalog*", { body: { data: [], pagination: { page: 1, totalPages: 1 } } });
    cy.intercept("GET", "**/api/products/best-sellers*", { body: { data: [] } });
    cy.intercept("GET", "**/api/categories*", { body: { data: [] } });
    cy.intercept("GET", "**/api/vitrine/categorias", { body: { data: [] } });
    cy.intercept("GET", "**/api/vitrine/banners", { body: { data: [] } });
    cy.intercept("GET", "**/api/product-reviews/destaques", { body: { data: [] } });
};

describe("Aviso de cookies e pixels", () => {
    before(() => Cypress.env("perguntarCookies", true));
    after(() => Cypress.env("perguntarCookies", false));

    beforeEach(() => {
        vitrineVazia();
        cy.intercept("GET", "**/api/vitrine/rastreamento", { body: { meta_pixel: "123456789012", ga4: null, tiktok_pixel: null } }).as("rastreamento");
        // O script da Meta não é baixado de verdade no teste.
        cy.intercept("GET", "https://connect.facebook.net/**", { body: "", headers: { "content-type": "application/javascript" } }).as("pixelMeta");
    });

    it("sem resposta, nada é carregado; ao aceitar, o Pixel entra e o aviso some", () => {
        cy.visit("/");
        cy.get('[data-cy="aviso-cookies"]').should("be.visible").and("contain", "cookies");
        cy.window().its("fbq").should("not.exist");

        cy.get('[data-cy="cookies-aceitar"]').click();
        cy.wait("@rastreamento");
        cy.get('[data-cy="aviso-cookies"]').should("not.exist");
        cy.window().its("fbq").should("be.a", "function");
        cy.window().its("fbq.queue").should((fila) => {
            expect(fila.map((c) => [...c])).to.deep.include(["init", "123456789012"]);
        });

        cy.reload();
        cy.get('[data-cy="aviso-cookies"]').should("not.exist");
    });

    it("recusar não carrega o Pixel", () => {
        cy.visit("/");
        cy.get('[data-cy="cookies-recusar"]').click();
        cy.get('[data-cy="aviso-cookies"]').should("not.exist");
        cy.window().its("fbq").should("not.exist");
    });

    it("em Privacidade dá para rever a escolha", () => {
        cy.visit("/privacidade", { onBeforeLoad: (win) => win.localStorage.setItem("agnus_cookies", "recusado") });
        cy.get('[data-cy="aviso-cookies"]').should("not.exist");
        cy.get('[data-cy="rever-cookies"]').click();
        cy.get('[data-cy="aviso-cookies"]').should("be.visible");
    });
});

describe("Preço no Pix", () => {
    it("a peça mostra o valor com 5% de desconto no Pix", () => {
        cy.intercept("GET", "**/api/products/9", { body: { id_produto: 9, nome: "Camiseta Fé", descricao: "Leve", preco_base: "100.00", preco_original: null, ativo: true } });
        cy.intercept("GET", "**/api/product-photos/9", { body: [] });
        cy.intercept("GET", "**/api/product-colors/9", { body: [{ id_produto_cor: 1, nome: "Preta", codigo_rgb: "rgb(0,0,0)", acrescimo: 0 }] });
        cy.intercept("GET", "**/api/product-grades/9", { body: [{ id_produto_grade: 2, nome: "M", acrescimo: 0 }] });
        cy.intercept("GET", "**/api/product-reviews/*", { body: [] });
        cy.intercept("GET", "**/api/products/catalog*", { body: { data: [], pagination: { page: 1, totalPages: 1 } } });

        cy.visit("/produto/9");
        cy.get('[data-cy="preco-pix"]').invoke("text").should("match", /R\$\s95,00 no Pix \(5% off\)/);
        // Dados estruturados para o Google.
        cy.get('script[type="application/ld+json"]#dados-da-peca').should(($s) => {
            const dados = JSON.parse($s.text());
            expect(dados).to.include({ "@type": "Product", name: "Camiseta Fé" });
            expect(dados.offers).to.include({ price: "100.00", priceCurrency: "BRL" });
        });
    });

    it("no pagamento, mostra quanto sai no Pix antes de escolher", () => {
        localStorage.setItem("auth_token", "fake-token");
        localStorage.setItem("auth", JSON.stringify({ id_usuario: 1, tipo: "cliente" }));
        cy.intercept("GET", "**/notifications/me", { body: { data: [], naoLidas: 0 } });
        cy.intercept("GET", "https://sdk.mercadopago.com/js/v2", { body: "window.MercadoPago=function(){return{bricks:function(){return{create:function(){return Promise.resolve({unmount:function(){}})}}}}};", headers: { "content-type": "application/javascript" } });
        cy.intercept("GET", "**/pagamentos/config", { body: { ativo: true, publicKey: "TEST-pk", desconto_pix: 5 } });
        cy.intercept("GET", "**/orders/42/pagamento", { body: { id_pedido: 42, status_pedido: "aguardando_pagamento", total: 200, total_pix: 190, pagamento: null } });

        cy.visit("/pagamento/42");
        cy.get('[data-cy="pagamento-total"]').invoke("text").should("match", /R\$\s200,00/);
        cy.get('[data-cy="pagamento-total-pix"]').invoke("text").should("match", /R\$\s190,00 \(5% off\)/);
    });
});

describe("Lembretes da sacola", () => {
    it("o link do e-mail desliga os lembretes", () => {
        cy.intercept("POST", "**/api/carts/lembretes/cancelar", { statusCode: 204 }).as("cancelar");
        cy.visit("/sacola/lembretes/cancelar?token=12345678-1234-1234-1234-123456789abc");
        cy.wait("@cancelar").its("request.body").should("deep.equal", { token: "12345678-1234-1234-1234-123456789abc" });
        cy.get('[data-cy="cancelar-lembretes-sacola"]').should("contain", "Lembretes desligados");
    });

    it("link sem código avisa", () => {
        cy.visit("/sacola/lembretes/cancelar");
        cy.get('[data-cy="cancelar-lembretes-sacola"]').should("contain", "inválido");
    });
});

describe("Google, Meta e prévia de link (servidor de verdade)", () => {
    it("robots.txt e sitemap.xml saem com o domínio da loja", () => {
        cy.request("/robots.txt").then(({ body, headers }) => {
            expect(headers["content-type"]).to.include("text/plain");
            expect(body).to.include("Disallow: /cliente").and.include("Sitemap: ").and.include("/sitemap.xml");
        });
        cy.request("/sitemap.xml").then(({ body, headers }) => {
            expect(headers["content-type"]).to.include("xml");
            expect(body).to.include("<urlset").and.include("/catalogo</loc>");
        });
    });

    it("o catálogo para anúncios é um RSS com o namespace do Google", () => {
        cy.request("/api/vitrine/feed.xml").then(({ body, headers }) => {
            expect(headers["content-type"]).to.include("xml");
            expect(body).to.include('xmlns:g="http://base.google.com/ns/1.0"').and.include("<channel>");
        });
    });

    it("robô do WhatsApp recebe a prévia; o navegador recebe o site", () => {
        cy.request({ url: "/catalogo", headers: { "User-Agent": "WhatsApp/2.23.20.0 A" } }).then(({ body }) => {
            expect(body).to.include('<meta property="og:title" content="Coleção · Agnus">');
            expect(body).not.to.include('id="root"');
        });
        cy.request("/catalogo").its("body").should("include", 'id="root"');
        // A foto da prévia continua sendo arquivo, mesmo para o robô.
        cy.request({ url: "/logo512.png", headers: { "User-Agent": "facebookexternalhit/1.1" }, encoding: "binary" })
            .its("headers.content-type")
            .should("include", "image/png");
    });
});
