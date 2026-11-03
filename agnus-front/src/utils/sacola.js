import { apiUrl, authHeaders } from "./api";

const CHAVE_VISITANTE = "agnus_sacola_visitante";

export const EVENTO_SACOLA = "agnus:sacola";

export class SessaoExpirada extends Error {}

function lerAuth() {
    try {
        return JSON.parse(localStorage.getItem("auth") || "{}") || {};
    } catch {
        return {};
    }
}

function tokenExpirado(token) {
    try {
        const { exp } = JSON.parse(atob(token.split(".")[1]));
        return Boolean(exp) && exp * 1000 <= Date.now();
    } catch {
        return false;
    }
}

export function encerrarSessao() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth");
    avisarSacola();
}

// Id do cliente com sessão válida, ou 0 para quem navega como visitante.
export function usuarioDaSessao() {
    const token = localStorage.getItem("auth_token");

    if (!token || tokenExpirado(token)) {
        return 0;
    }

    const auth = lerAuth();
    const user = auth.user || auth;

    return Number(user.id_usuario || user.id || 0);
}

export function sessaoDeAdmin() {
    const auth = lerAuth();

    return (auth.user?.tipo || auth.tipo) === "administrador";
}

export function avisarSacola() {
    window.dispatchEvent(new Event(EVENTO_SACOLA));
}

export function formatarReal(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

export function lerSacolaVisitante() {
    try {
        const itens = JSON.parse(localStorage.getItem(CHAVE_VISITANTE) || "[]");
        return Array.isArray(itens) ? itens : [];
    } catch {
        return [];
    }
}

export function salvarSacolaVisitante(itens) {
    if (itens.length) {
        localStorage.setItem(CHAVE_VISITANTE, JSON.stringify(itens));
    } else {
        localStorage.removeItem(CHAVE_VISITANTE);
    }

    avisarSacola();
}

export function adicionarVisitante(item) {
    const itens = lerSacolaVisitante();
    const id = `v-${item.id_produto_cor}-${item.id_produto_grade}`;
    const existente = itens.find((i) => i.id_carrinho_item === id);

    if (existente) {
        existente.quantidade += item.quantidade;
    } else {
        itens.push({ ...item, id_carrinho_item: id });
    }

    salvarSacolaVisitante(itens);
}

async function pedir(caminho, opcoes = {}) {
    const { manterSessao, ...requisicao } = opcoes;
    const res = await fetch(apiUrl(caminho), {
        ...requisicao,
        headers: authHeaders(requisicao.body ? { "Content-Type": "application/json" } : {}),
    });

    if (res.status === 401) {
        if (!manterSessao) {
            encerrarSessao();
        }

        throw new SessaoExpirada();
    }

    return res;
}

async function buscarCarrinho(idUsuario, opcoes) {
    const res = await pedir(`carts?id_usuario=${idUsuario}`, opcoes);

    if (!res.ok) {
        throw new Error("Não foi possível abrir a sacola.");
    }

    const carrinhos = await res.json();

    return Array.isArray(carrinhos) ? carrinhos[0] : null;
}

export async function listarItens(idUsuario, opcoes) {
    const carrinho = await buscarCarrinho(idUsuario, opcoes);

    if (!carrinho) {
        return [];
    }

    const res = await pedir(`cart-items/${carrinho.id_carrinho}`, opcoes);

    if (!res.ok) {
        throw new Error("Não foi possível abrir a sacola.");
    }

    const itens = await res.json();

    return Array.isArray(itens) ? itens : [];
}

export async function adicionarItem(idUsuario, item) {
    let carrinho = await buscarCarrinho(idUsuario);

    if (!carrinho) {
        const res = await pedir("carts", {
            method: "POST",
            body: JSON.stringify({ id_usuario: idUsuario }),
        });

        if (!res.ok) {
            throw new Error("Não foi possível abrir a sacola.");
        }

        carrinho = await res.json();
    }

    const itensRes = await pedir(`cart-items/${carrinho.id_carrinho}`);
    const itens = itensRes.ok ? await itensRes.json() : [];
    const existente = (Array.isArray(itens) ? itens : []).find((i) =>
        Number(i.id_produto_cor) === Number(item.id_produto_cor) &&
        Number(i.id_produto_grade) === Number(item.id_produto_grade)
    );

    const res = existente
        ? await pedir(`cart-items/${existente.id_carrinho_item}`, {
            method: "PUT",
            body: JSON.stringify({ quantidade: Number(existente.quantidade) + item.quantidade }),
        })
        : await pedir("cart-items", {
            method: "POST",
            body: JSON.stringify({
                id_carrinho: carrinho.id_carrinho,
                id_produto_cor: item.id_produto_cor,
                id_produto_grade: item.id_produto_grade,
                quantidade: item.quantidade,
                preco_unitario: item.preco_unitario,
            }),
        });

    if (!res.ok) {
        throw new Error("Não foi possível adicionar a peça.");
    }
}

// Leva para a conta o que o cliente escolheu antes de entrar. Só tira da lista local o que foi
// gravado, para uma falha no meio não apagar a escolha dele.
export async function sincronizarVisitante(idUsuario) {
    const pendentes = lerSacolaVisitante();

    for (const item of pendentes) {
        await adicionarItem(idUsuario, item);
        salvarSacolaVisitante(
            lerSacolaVisitante().filter((i) => i.id_carrinho_item !== item.id_carrinho_item)
        );
    }
}

// Só alimenta o contador do cabeçalho: uma falha aqui não pode encerrar a sessão de quem navega.
export async function contarPecas() {
    const idUsuario = usuarioDaSessao();
    const soma = (itens) => itens.reduce((total, i) => total + Number(i.quantidade || 0), 0);
    const visitante = soma(lerSacolaVisitante());

    if (!idUsuario) {
        return visitante;
    }

    return visitante + soma(await listarItens(idUsuario, { manterSessao: true }));
}
