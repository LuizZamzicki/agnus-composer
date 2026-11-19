import { apiUrl } from "./api";

// Pixel da Meta (Instagram e Facebook), Google Analytics 4 e Pixel do TikTok.
// Nada é carregado antes de o visitante aceitar os cookies (LGPD). Os IDs ficam no servidor
// (META_PIXEL_ID, GA4_ID e TIKTOK_PIXEL_ID em services/.env): sem ID, aquele serviço fica de fora.
// Os ids das peças são os mesmos do catálogo para anúncios (/api/vitrine/feed.xml): o produto
// ("7") na página da peça e a cor + tamanho ("7-3-10") na sacola e na compra.

export const CHAVE_CONSENTIMENTO = "agnus_cookies";
export const EVENTO_CONSENTIMENTO = "agnus:cookies";
const MOEDA = "BRL";

let estado = "parado"; // parado | carregando | pronto | desligado
let fila = [];
let ativos = { meta: false, ga4: false, tiktok: false };

export function lerConsentimento() {
    try {
        const valor = localStorage.getItem(CHAVE_CONSENTIMENTO);
        return valor === "aceito" || valor === "recusado" ? valor : null;
    } catch {
        return null;
    }
}

// valor: "aceito", "recusado" ou null (volta a perguntar).
export function definirConsentimento(valor) {
    try {
        if (valor) localStorage.setItem(CHAVE_CONSENTIMENTO, valor);
        else localStorage.removeItem(CHAVE_CONSENTIMENTO);
    } catch {
        // Sem armazenamento (aba anônima bloqueada): vale só para esta visita.
    }
    window.dispatchEvent(new Event(EVENTO_CONSENTIMENTO));
    if (valor === "aceito") iniciarRastreamento();
}

function adicionarScript(src) {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
}

function carregarMeta(id) {
    if (window.fbq) return;
    const fbq = function (...args) {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;
    adicionarScript("https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", id);
}

function carregarGa4(id) {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        // O gtag.js espera o objeto arguments, não um array.
        // eslint-disable-next-line prefer-rest-params
        window.dataLayer.push(arguments);
    };
    adicionarScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
    window.gtag("js", new Date());
    // A troca de página do site é feita pelo React: a visualização vai em paginaVista().
    window.gtag("config", id, { send_page_view: false });
}

function carregarTikTok(id) {
    if (window.ttq) return;
    const ttq = [];
    ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
    ttq.setAndDefer = (alvo, metodo) => {
        alvo[metodo] = (...args) => alvo.push([metodo, ...args]);
    };
    ttq.methods.forEach((metodo) => ttq.setAndDefer(ttq, metodo));
    ttq.instance = (nome) => {
        const instancia = ttq._i[nome] || [];
        ttq.methods.forEach((metodo) => ttq.setAndDefer(instancia, metodo));
        return instancia;
    };
    ttq.load = (sdk) => {
        const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[sdk] = [];
        ttq._i[sdk]._u = src;
        ttq._t = ttq._t || {};
        ttq._t[sdk] = Date.now();
        ttq._o = ttq._o || {};
        ttq._o[sdk] = {};
        adicionarScript(`${src}?sdkid=${encodeURIComponent(sdk)}&lib=ttq`);
    };
    window.TiktokAnalyticsObject = "ttq";
    window.ttq = ttq;
    ttq.load(id);
}

export async function iniciarRastreamento() {
    if (lerConsentimento() !== "aceito" || estado === "carregando" || estado === "pronto") return;
    estado = "carregando";

    try {
        const res = await fetch(apiUrl("vitrine/rastreamento"));
        const ids = res.ok ? await res.json() : {};

        if (ids.meta_pixel) carregarMeta(ids.meta_pixel);
        if (ids.ga4) carregarGa4(ids.ga4);
        if (ids.tiktok_pixel) carregarTikTok(ids.tiktok_pixel);

        ativos = { meta: Boolean(ids.meta_pixel), ga4: Boolean(ids.ga4), tiktok: Boolean(ids.tiktok_pixel) };
        estado = ativos.meta || ativos.ga4 || ativos.tiktok ? "pronto" : "desligado";
    } catch {
        estado = "desligado";
    }

    const pendentes = fila;
    fila = [];
    if (estado === "pronto") pendentes.forEach((evento) => evento());
}

// Eventos que chegam antes dos scripts esperam na fila; com cookies recusados, não vão a lugar nenhum.
function registrar(evento) {
    if (lerConsentimento() !== "aceito" || estado === "desligado") return;
    if (estado === "pronto") {
        try {
            evento();
        } catch {
            // Um serviço de anúncios fora do ar nunca atrapalha a compra.
        }
        return;
    }
    if (fila.length < 50) fila.push(evento);
}

const dinheiro = (valor) => Math.round((Number(valor) || 0) * 100) / 100;
export const idDaVariacao = (idProduto, idCor, idGrade) => `${idProduto}-${idCor}-${idGrade}`;

export function paginaVista(caminho) {
    registrar(() => {
        if (ativos.meta) window.fbq("track", "PageView");
        if (ativos.ga4) window.gtag("event", "page_view", { page_path: caminho, page_location: window.location.href, page_title: document.title });
        if (ativos.tiktok) window.ttq.page();
    });
}

export function verPeca({ id_produto, nome, preco, categoria }) {
    const valor = dinheiro(preco);
    const id = String(id_produto);
    registrar(() => {
        if (ativos.meta) window.fbq("track", "ViewContent", { content_ids: [id], content_type: "product_group", content_name: nome, value: valor, currency: MOEDA });
        if (ativos.ga4) window.gtag("event", "view_item", { currency: MOEDA, value: valor, items: [{ item_id: id, item_name: nome, item_category: categoria || undefined, price: valor }] });
        if (ativos.tiktok) window.ttq.track("ViewContent", { contents: [{ content_id: id, content_name: nome, price: valor }], content_type: "product_group", value: valor, currency: MOEDA });
    });
}

// itens: [{ id_produto, id_produto_cor, id_produto_grade, nome, preco (unitário), quantidade }]
const paraOsServicos = (itens) => {
    const lista = itens.map((item) => ({
        id: idDaVariacao(item.id_produto, item.id_produto_cor, item.id_produto_grade),
        id_produto: String(item.id_produto),
        nome: item.nome,
        preco: dinheiro(item.preco),
        quantidade: Number(item.quantidade) || 1,
    }));
    return {
        lista,
        meta: { content_ids: lista.map((i) => i.id), contents: lista.map((i) => ({ id: i.id, quantity: i.quantidade, item_price: i.preco })), content_type: "product", num_items: lista.reduce((t, i) => t + i.quantidade, 0) },
        ga4: lista.map((i) => ({ item_id: i.id_produto, item_name: i.nome, item_variant: i.id, price: i.preco, quantity: i.quantidade })),
        tiktok: lista.map((i) => ({ content_id: i.id, content_name: i.nome, price: i.preco, quantity: i.quantidade })),
    };
};

export function adicionouNaSacola(item) {
    const { meta, ga4, tiktok } = paraOsServicos([item]);
    const valor = dinheiro(Number(item.preco) * (Number(item.quantidade) || 1));
    registrar(() => {
        if (ativos.meta) window.fbq("track", "AddToCart", { ...meta, value: valor, currency: MOEDA });
        if (ativos.ga4) window.gtag("event", "add_to_cart", { currency: MOEDA, value: valor, items: ga4 });
        if (ativos.tiktok) window.ttq.track("AddToCart", { contents: tiktok, content_type: "product", value: valor, currency: MOEDA });
    });
}

export function iniciouCompra(itens, total) {
    if (!itens.length) return;
    const { meta, ga4, tiktok } = paraOsServicos(itens);
    const valor = dinheiro(total);
    registrar(() => {
        if (ativos.meta) window.fbq("track", "InitiateCheckout", { ...meta, value: valor, currency: MOEDA });
        if (ativos.ga4) window.gtag("event", "begin_checkout", { currency: MOEDA, value: valor, items: ga4 });
        if (ativos.tiktok) window.ttq.track("InitiateCheckout", { contents: tiktok, content_type: "product", value: valor, currency: MOEDA });
    });
}

const CHAVE_COMPRAS = "agnus_compras_rastreadas";

function jaRastreada(idPedido) {
    try {
        const lista = JSON.parse(localStorage.getItem(CHAVE_COMPRAS) || "[]");
        if (lista.includes(idPedido)) return true;
        localStorage.setItem(CHAVE_COMPRAS, JSON.stringify([...lista, idPedido].slice(-30)));
    } catch {
        // Sem armazenamento: pode contar de novo se a página for recarregada.
    }
    return false;
}

// Compra paga: uma vez por pedido neste navegador (recarregar a página não conta duas vezes).
export function comprou({ id_pedido, total, itens }) {
    if (lerConsentimento() !== "aceito" || estado === "desligado") return;
    const idPedido = String(id_pedido);
    if (jaRastreada(idPedido)) return;
    const { meta, ga4, tiktok } = paraOsServicos(itens);
    const valor = dinheiro(total);
    registrar(() => {
        if (ativos.meta) window.fbq("track", "Purchase", { ...meta, value: valor, currency: MOEDA }, { eventID: `pedido-${idPedido}` });
        if (ativos.ga4) window.gtag("event", "purchase", { transaction_id: idPedido, currency: MOEDA, value: valor, items: ga4 });
        if (ativos.tiktok) window.ttq.track("CompletePayment", { contents: tiktok, content_type: "product", value: valor, currency: MOEDA, order_id: idPedido });
    });
}

// Item da sacola ou do pedido (como a API devolve) no formato dos eventos.
export const itemParaRastreio = (item) => ({
    id_produto: item.produto?.id_produto ?? item.id_produto,
    id_produto_cor: item.id_produto_cor,
    id_produto_grade: item.id_produto_grade,
    nome: item.nome_produto ?? item.produto?.nome ?? "",
    preco: Number(item.preco_unitario ?? 0),
    quantidade: Number(item.quantidade ?? 1),
});
