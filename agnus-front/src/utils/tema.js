// Tema da loja: claro por padrão; escuro se o sistema pedir ou se a pessoa escolher.
// A escolha explícita fica em data-theme no <html> e no localStorage.
const CHAVE = "agnus_tema";

function lerEscolha() {
    try {
        const valor = localStorage.getItem(CHAVE);
        return valor === "dark" || valor === "light" ? valor : null;
    } catch {
        return null;
    }
}

function sistemaPedeEscuro() {
    return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function temaAtual() {
    return lerEscolha() ?? (sistemaPedeEscuro() ? "dark" : "light");
}

export function aplicarTemaSalvo(root = document.documentElement) {
    const escolha = lerEscolha();

    if (escolha) {
        root.dataset.theme = escolha;
    } else {
        delete root.dataset.theme;
    }
}

export function definirTema(tema, root = document.documentElement) {
    try {
        localStorage.setItem(CHAVE, tema);
    } catch {
        // Sem localStorage (modo privado), a escolha vale só até recarregar.
    }

    root.dataset.theme = tema;
}

export function alternarTema(root = document.documentElement) {
    const novo = temaAtual() === "dark" ? "light" : "dark";
    definirTema(novo, root);
    return novo;
}
