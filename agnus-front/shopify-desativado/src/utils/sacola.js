// Sessão do cliente e avisos da sacola. A sacola em si vive no Shopify (ver utils/loja.js).

export const EVENTO_SACOLA = "agnus:sacola";

// Id da sacola do Shopify neste navegador e a conta a que ela já foi ligada.
export const CHAVE_SACOLA = "agnus_sacola_shopify";
export const CHAVE_DONO_SACOLA = "agnus_sacola_shopify_dono";

// Sacola do catálogo antigo: as peças dela não existem no Shopify.
const CHAVE_SACOLA_ANTIGA = "agnus_sacola_visitante";

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

export function avisarSacola() {
    window.dispatchEvent(new Event(EVENTO_SACOLA));
}

// A sacola ligada à conta não pode ficar à vista de quem usar o navegador depois; ao entrar de
// novo, o cliente a recupera pela conta.
export function esquecerSacola() {
    localStorage.removeItem(CHAVE_SACOLA);
    localStorage.removeItem(CHAVE_DONO_SACOLA);
    localStorage.removeItem(CHAVE_SACOLA_ANTIGA);
}

export function encerrarSessao() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth");

    if (localStorage.getItem(CHAVE_DONO_SACOLA)) {
        esquecerSacola();
    }

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

export function formatarReal(valor) {
    return Number(valor || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}
