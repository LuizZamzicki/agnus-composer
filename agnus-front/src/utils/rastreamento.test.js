import { valorNoPix } from "../components/precoProduto";
import { dadosDaPeca } from "./seo";

// Cada teste carrega o módulo do zero (o estado do rastreamento é do módulo).
const carregar = () => {
    let modulo;
    jest.isolateModules(() => {
        modulo = require("./rastreamento");
    });
    return modulo;
};

beforeEach(() => {
    localStorage.clear();
    delete window.fbq;
    delete window.gtag;
    delete window.ttq;
    document.head.innerHTML = "";
    window.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ meta_pixel: "123456789012", ga4: "G-TESTE123", tiktok_pixel: null }) }));
});

test("sem aceitar os cookies, nenhum script é carregado", async () => {
    const r = carregar();
    await r.iniciarRastreamento();
    r.paginaVista("/");
    expect(window.fetch).not.toHaveBeenCalled();
    expect(document.querySelectorAll("script")).toHaveLength(0);
});

test("ao aceitar, carrega o Pixel e o Analytics e manda os eventos que estavam na fila", async () => {
    const r = carregar();
    localStorage.setItem(r.CHAVE_CONSENTIMENTO, "aceito");
    r.paginaVista("/produto/7");
    await r.iniciarRastreamento();

    const fontes = [...document.querySelectorAll("script")].map((s) => s.src);
    expect(fontes).toEqual(expect.arrayContaining([
        "https://connect.facebook.net/en_US/fbevents.js",
        "https://www.googletagmanager.com/gtag/js?id=G-TESTE123",
    ]));
    expect(window.fbq.queue).toEqual(expect.arrayContaining([["init", "123456789012"], ["track", "PageView"]]));
    expect(window.ttq).toBeUndefined();
});

test("compra conta uma vez por pedido, com o id da cor e do tamanho", async () => {
    const r = carregar();
    localStorage.setItem(r.CHAVE_CONSENTIMENTO, "aceito");
    await r.iniciarRastreamento();
    const itens = [{ id_produto: 7, id_produto_cor: 3, id_produto_grade: 10, nome: "Camiseta", preco: 89.9, quantidade: 2 }];

    r.comprou({ id_pedido: 42, total: 179.8, itens });
    r.comprou({ id_pedido: 42, total: 179.8, itens });

    const compras = window.fbq.queue.filter((c) => c[1] === "Purchase");
    expect(compras).toHaveLength(1);
    expect(compras[0][2]).toMatchObject({ content_ids: ["7-3-10"], value: 179.8, currency: "BRL" });
    expect(compras[0][3]).toEqual({ eventID: "pedido-42" });
});

test("recusar não carrega nada", async () => {
    const r = carregar();
    r.definirConsentimento("recusado");
    await r.iniciarRastreamento();
    expect(window.fetch).not.toHaveBeenCalled();
});

test("preço no Pix: 5% a menos, como no servidor", () => {
    expect(valorNoPix(100)).toBe(95);
    expect(valorNoPix(149.9)).toBe(142.4);
});

test("dados da peça para o Google", () => {
    const dados = dadosDaPeca({ id_produto: 7, nome: "Camiseta", descricao: "Leve", preco_base: "89.9" }, ["/api/produto_fotos/a.jpg"], "https://agnusfit.com");
    expect(dados).toMatchObject({
        "@type": "Product",
        name: "Camiseta",
        offers: { price: "89.90", priceCurrency: "BRL", url: "https://agnusfit.com/produto/7" },
    });
    expect(dados.image[0]).toMatch(/\/api\/produto_fotos\/a\.jpg$/);
});
