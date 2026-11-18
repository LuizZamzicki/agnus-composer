// Respostas do serviço "loja" (Shopify Storefront) já no formato que o front recebe.

export function cartao(numero, extra = {}) {
    return {
        id: `gid://shopify/Product/${numero}`,
        idNumerico: String(numero),
        handle: `peca-${numero}`,
        nome: `Peça ${numero}`,
        disponivel: true,
        preco: 100 * numero,
        precoComparado: null,
        moeda: "BRL",
        imagens: [],
        ...extra,
    };
}

export function pagina(produtos, paginacao = {}) {
    return {
        produtos,
        paginacao: { temProxima: false, temAnterior: false, inicio: null, fim: null, ...paginacao },
    };
}

const variante = (id, tamanho, cor, extra = {}) => ({
    id: `gid://shopify/ProductVariant/${id}`,
    nome: `${tamanho} / ${cor}`,
    disponivel: true,
    preco: 129.9,
    precoComparado: null,
    opcoes: { Tamanho: tamanho, Cor: cor },
    imagem: null,
    ...extra,
});

// Regata com tamanhos M/G e cores Preto/Branco; a G Branca está esgotada.
export function regata(extra = {}) {
    return {
        id: "gid://shopify/Product/1",
        idNumerico: "1",
        handle: "regata-crucifixo",
        nome: "Regata Crucifixo",
        descricao: "Regata de treino com crucifixo e asas.",
        disponivel: true,
        preco: 129.9,
        moeda: "BRL",
        imagens: [{ url: "https://cdn.shopify.com/regata.jpg", alt: "" }],
        opcoes: [
            { nome: "Tamanho", valores: [{ nome: "M", cor: null }, { nome: "G", cor: null }] },
            { nome: "Cor", valores: [{ nome: "Preto", cor: "#111111" }, { nome: "Branco", cor: "#ffffff" }] },
        ],
        variantes: [
            variante(11, "M", "Preto"),
            variante(12, "M", "Branco"),
            variante(13, "G", "Preto"),
            variante(14, "G", "Branco", { disponivel: false }),
        ],
        ...extra,
    };
}

export function sacola(linhas = [], extra = {}) {
    const total = linhas.reduce((soma, l) => soma + l.precoUnitario * l.quantidade, 0);

    return {
        id: "c2Fjb2xh",
        quantidade: linhas.reduce((soma, l) => soma + l.quantidade, 0),
        subtotal: total,
        total,
        moeda: "BRL",
        linhas,
        ...extra,
    };
}

export function linha(numero, quantidade = 1, extra = {}) {
    return {
        id: `bGluaGE${numero}`,
        quantidade,
        precoUnitario: 100,
        total: 100 * quantidade,
        varianteId: `gid://shopify/ProductVariant/${numero}`,
        disponivel: true,
        opcoes: [{ nome: "Tamanho", valor: "M" }, { nome: "Cor", valor: "Preto" }],
        produto: { handle: "regata-crucifixo", nome: "Regata Crucifixo" },
        imagem: null,
        ...extra,
    };
}

// Vitrine mínima para páginas que só precisam carregar (coleções vazias, sem avaliações).
export function mockVitrine(produtos = [cartao(1), cartao(2)]) {
    cy.intercept("GET", "**/loja/colecoes", { body: [] }).as("colecoes");
    cy.intercept("GET", "**/loja/produtos?*", { body: pagina(produtos) }).as("produtos");
    cy.intercept("GET", "**/product-reviews/*", { body: [] });
}
