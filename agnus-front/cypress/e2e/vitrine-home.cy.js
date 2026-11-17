// Vitrine: banner de campanha (foto grande), compre por categoria, depoimentos, produto (caminho,
// compartilhar e barra fixa no celular) e a tela Vitrine do admin. Dados simulados com cy.intercept.
const banner = (id, extra = {}) => ({
    id_banner: id,
    titulo: `Campanha ${id}`,
    subtitulo: "Texto da campanha",
    sobretitulo: "Black Friday",
    texto_botao: "Ver a coleção",
    link: "/catalogo",
    imagem_url: "produto_fotos/banner.png",
    imagem_mobile_url: null,
    alinhamento: "esquerda",
    foco: "centro",
    ...extra
});

const categorias = [
    { id_categoria: 22, nome: "Camisetas", total: 6, imagem_url: "produto_fotos/a.png" },
    { id_categoria: 23, nome: "Regatas", total: 1, imagem_url: "produto_fotos/b.png" }
];

describe("Vitrine da home", () => {
    beforeEach(() => {
        cy.intercept("GET", "**/api/products/catalog*", { body: { data: [], pagination: { page: 1, totalPages: 1 } } }).as("catalogo");
        cy.intercept("GET", "**/api/products/best-sellers*", { body: { data: [] } });
        cy.intercept("GET", "**/api/categories*", { body: { data: categorias } });
        cy.intercept("GET", "**/api/vitrine/categorias", { body: { data: categorias } });
        cy.intercept("GET", "**/api/product-reviews/destaques", { body: { data: [] } });
    });

    it("banner único: foto grande com título e botão para a página da loja", () => {
        cy.intercept("GET", "**/api/vitrine/banners", { body: { data: [banner(1)] } });
        cy.visit("/");
        cy.get('[data-cy="banner-campanha"]').scrollIntoView().should("be.visible").within(() => {
            cy.contains("h2", "Campanha 1");
            cy.contains("Black Friday");
            cy.get(".banner-seta").should("not.exist");
            cy.get('[data-cy="banner-botao"]').should("have.attr", "href", "/catalogo");
        });
    });

    it("vários banners: vira carrossel com setas e pontos", () => {
        cy.intercept("GET", "**/api/vitrine/banners", { body: { data: [banner(1), banner(2, { alinhamento: "centro" })] } });
        cy.visit("/");
        cy.get('[data-cy="banner-campanha"]').scrollIntoView();
        cy.get('[data-cy="banner-slide"]').eq(0).should("have.class", "is-atual");
        cy.get(".banner-pontos button").eq(1).click();
        cy.get('[data-cy="banner-slide"]').eq(1).should("have.class", "is-atual");
        cy.get('[data-cy="banner-slide"]').eq(0).should("have.attr", "aria-hidden", "true");
        cy.get(".banner-seta--proxima").click();
        cy.get('[data-cy="banner-slide"]').eq(0).should("have.class", "is-atual");
    });

    it("sem banner cadastrado: a seção não aparece", () => {
        cy.intercept("GET", "**/api/vitrine/banners", { body: { data: [] } });
        cy.visit("/");
        cy.get('[data-cy="compre-categoria"]').should("exist");
        cy.get('[data-cy="banner-campanha"]').should("not.exist");
    });

    it("compre por categoria abre o catálogo já filtrado", () => {
        cy.intercept("GET", "**/api/vitrine/banners", { body: { data: [] } });
        cy.visit("/");
        cy.get('[data-cy="categoria-bloco"]').should("have.length", 2).first().should("contain", "Camisetas").and("contain", "6 peças");
        cy.intercept("GET", "**/api/products/catalog*id_categoria=23*", { body: { data: [], pagination: { page: 1, totalPages: 1 } } }).as("filtrado");
        cy.contains('[data-cy="categoria-bloco"]', "Regatas").click();
        cy.location("search").should("eq", "?categoria=23");
        cy.wait("@filtrado");
        cy.contains("button", "Regatas").should("have.attr", "aria-pressed", "true");
    });

    it("depoimentos: mostra avaliações reais com compra verificada; sem avaliação, some", () => {
        cy.intercept("GET", "**/api/vitrine/banners", { body: { data: [] } });
        cy.intercept("GET", "**/api/product-reviews/destaques", {
            body: { data: [{ id_avaliacao_produto: 1, id_produto: 4, produto: "Tank Top", nome: "Ana", nota: 5, titulo: "Perfeita", comentario: "Caimento ótimo.", foto: null }] }
        });
        cy.visit("/");
        cy.get('[data-cy="depoimento"]').should("have.length", 1).and("contain", "Ana").and("contain", "Compra verificada").and("contain", "Caimento ótimo.");
        cy.get('[data-cy="depoimento"] a').should("have.attr", "href", "/produto/4");
    });
});

describe("Página do produto", () => {
    beforeEach(() => {
        cy.intercept("GET", "**/api/products/4", {
            body: { id_produto: 4, id_categoria: 23, nome: "Tank Top Machão", descricao: "Regata.", preco_base: "64.90", preco_original: "89.90" }
        });
        cy.intercept("GET", "**/api/categories/23", { body: { id_categoria: 23, nome: "Regatas" } });
        cy.intercept("GET", "**/api/product-photos/4", { body: [] });
        cy.intercept("GET", "**/api/product-colors/4", { body: [{ id_produto_cor: 1, nome: "Preto", hex: "#000" }] });
        cy.intercept("GET", "**/api/product-grades/4", { body: [{ id_produto_grade: 1, nome: "M" }, { id_produto_grade: 2, nome: "G" }] });
        cy.intercept("GET", "**/api/product-reviews/4", { body: [] });
    });

    it("caminho até a peça, parcela e compartilhar no WhatsApp", () => {
        cy.visit("/produto/4");
        cy.get('[data-cy="trilha"]').should("contain", "Início").and("contain", "Coleção").and("contain", "Regatas").and("contain", "Tank Top Machão");
        cy.get('[data-cy="trilha"] a').contains("Regatas").should("have.attr", "href", "/catalogo?categoria=23");
        cy.get('[data-cy="parcela-produto"]').first().invoke("text").should("match", /2x de R\$\s32,45 sem juros/);
        cy.get('[data-cy="compartilhar-whatsapp"]').should("have.attr", "href").and("include", "wa.me").and("include", encodeURIComponent("Tank Top Machão"));
    });

    it("título da aba com o nome da peça e sugestões da mesma categoria primeiro", () => {
        const item = (id, cat, nome) => ({ id_produto: id, id_categoria: cat, nome, preco_base: "50.00", imagens: [] });
        cy.intercept("GET", "**/api/products/catalog*", {
            body: { data: [item(4, 23, "Tank Top Machão"), item(9, 22, "Camiseta Classic"), item(7, 23, "Regata Cavada"), item(10, 22, "Camiseta 220g"), item(11, 22, "Camiseta UV"), item(12, 24, "Short 2 em 1")] }
        });
        cy.visit("/produto/4");
        cy.title().should("eq", "Tank Top Machão · Agnus");
        cy.get('[data-cy="relacionados"] .relacionado-card').should("have.length", 4).first().should("contain", "Regata Cavada");
        cy.get('[data-cy="relacionados"]').should("not.contain", "Tank Top Machão");
    });

    it("sem outras peças, a seção de sugestões não aparece", () => {
        cy.intercept("GET", "**/api/products/catalog*", { body: { data: [] } });
        cy.visit("/produto/4");
        cy.contains("h1", "Tank Top Machão");
        cy.get('[data-cy="relacionados"]').should("not.exist");
    });

    it("celular: barra de compra aparece ao rolar e pede o tamanho que falta", () => {
        cy.viewport(390, 844);
        cy.visit("/produto/4");
        cy.get('[data-cy="adicionar-carrinho"]').should("exist");
        cy.get('[data-cy="barra-compra"]').should("not.exist");
        cy.scrollTo("bottom");
        cy.get('[data-cy="barra-compra"]').should("be.visible").invoke("text").should("match", /R\$\s64,90/);
        cy.get('[data-cy="barra-compra"] button').should("contain", "Escolher tamanho").click();
        cy.get(".produto-opcao.falta").should("exist");
    });
});

describe("Admin: Vitrine da loja", () => {
    const visitar = () =>
        cy.visit("/admin/vitrine", {
            onBeforeLoad(win) {
                win.localStorage.setItem("auth_token", "fake-admin-token");
                win.localStorage.setItem("auth", JSON.stringify({ user: { id_usuario: 1, nome: "Admin", tipo: "administrador" } }));
            }
        });

    beforeEach(() => {
        cy.intercept("GET", "**/categories*", { body: { data: [{ id_categoria: 22, nome: "Camisetas" }] } });
        cy.intercept("GET", "**/vitrine/categorias*", { body: { data: [{ ...categorias[0], foto_escolhida: false }] } });
    });

    it("lista banners com a situação e abre a edição preenchida", () => {
        cy.intercept("GET", "**/vitrine/banners/todos", {
            body: { data: [{ ...banner(1), ordem: 0, ativo: true, inicio: null, fim: null }, { ...banner(2), ordem: 1, ativo: false, inicio: null, fim: null }] }
        });
        visitar();
        cy.get('[data-cy="banner-item"]').should("have.length", 2);
        cy.get('[data-cy="banner-item"]').eq(0).should("contain", "No ar");
        cy.get('[data-cy="banner-item"]').eq(1).should("contain", "Desativado");
        cy.get('[data-cy="editar-banner"]').first().click();
        cy.get('[data-cy="banner-titulo"]').should("have.value", "Campanha 1");
        cy.get('[data-cy="banner-link"]').should("have.value", "/catalogo");
        cy.get('[data-cy="foto-categoria"]').should("contain", "Camisetas").and("contain", "Automática");
    });

    it("novo banner: sem foto não envia; com foto envia multipart", () => {
        cy.intercept("GET", "**/vitrine/banners/todos", { body: { data: [] } });
        cy.intercept("POST", "**/vitrine/banners", { statusCode: 201, body: { id_banner: 9 } }).as("criar");
        visitar();
        cy.get('[data-cy="novo-banner"]').click();
        cy.get('[data-cy="banner-titulo"]').type("Coleção de inverno");
        cy.get('[data-cy="salvar-banner"]').click();
        cy.contains("Escolha a foto do banner.").should("exist");

        cy.get('[data-cy="banner-imagem"]').selectFile({ contents: Cypress.Buffer.from("fake"), fileName: "banner.jpg", mimeType: "image/jpeg" }, { force: true });
        cy.get('[data-cy="salvar-banner"]').click();
        cy.wait("@criar").its("request.headers.content-type").should("include", "multipart/form-data");
        cy.get('[data-cy="form-banner"]').should("not.exist");
    });
});
