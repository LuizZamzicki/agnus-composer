// Cupom recebido ao se inscrever nas ofertas: fica guardado neste navegador e já aparece
// preenchido no "Finalizar pedido". Sem acesso ao armazenamento, o cliente digita o código.
const CHAVE = "agnus_cupom";

export function lerCupomGuardado() {
    try {
        return window.localStorage.getItem(CHAVE) || "";
    } catch {
        return "";
    }
}

export function guardarCupom(codigo) {
    try {
        window.localStorage.setItem(CHAVE, codigo);
    } catch {
        /* sem armazenamento: segue sem guardar */
    }
}

export function esquecerCupomGuardado() {
    try {
        window.localStorage.removeItem(CHAVE);
    } catch {
        /* nada a fazer */
    }
}
