import { apiUrl } from "./api";

// Cotação do frete pelo CEP (POST /frete/cotacao). O CEP digitado fica guardado neste navegador
// para a sacola e a página da peça já abrirem com o frete calculado.
const CHAVE_CEP = "agnus_cep";
const cache = new Map();

export const somenteDigitos = (valor) => String(valor ?? "").replace(/\D/g, "").slice(0, 8);
export const formatarCep = (valor) => {
    const d = somenteDigitos(valor);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export function lerCepGuardado() {
    try {
        return somenteDigitos(window.localStorage.getItem(CHAVE_CEP) || "");
    } catch {
        return "";
    }
}

export function guardarCep(cep) {
    try {
        window.localStorage.setItem(CHAVE_CEP, somenteDigitos(cep));
    } catch {
        /* sem armazenamento: segue sem guardar */
    }
}

export class ErroFrete extends Error {}

export async function cotarFrete(cep, pecas, valorPecas) {
    const digitos = somenteDigitos(cep);
    if (digitos.length !== 8) throw new ErroFrete("Digite os 8 números do CEP.");

    const chave = `${digitos}|${pecas}|${Math.round(Number(valorPecas) * 100)}`;
    if (cache.has(chave)) return cache.get(chave);

    let res;
    try {
        res = await fetch(apiUrl("frete/cotacao"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cep: digitos, pecas, valor_pecas: valorPecas }),
        });
    } catch {
        throw new ErroFrete("Sem conexão para calcular o frete. Tente de novo.");
    }

    const dados = await res.json().catch(() => ({}));
    if (res.status === 429) throw new ErroFrete("Muitas consultas seguidas. Espere um minuto e tente de novo.");
    if (!res.ok) throw new ErroFrete(dados.message || "Não foi possível calcular o frete agora.");
    if (!Array.isArray(dados.opcoes) || dados.opcoes.length === 0) throw new ErroFrete("Não encontramos entrega para esse CEP.");

    cache.set(chave, dados);
    return dados;
}

export const textoPrazo = (dias) => (dias === 1 ? "1 dia útil" : `até ${dias} dias úteis`);

// Opção escolhida na sacola (PAC, SEDEX...): o checkout já abre com ela marcada, se ainda existir.
const CHAVE_SERVICO = "agnus_frete_servico";

export function lerServicoEscolhido() {
    try {
        return window.sessionStorage.getItem(CHAVE_SERVICO) || null;
    } catch {
        return null;
    }
}

export function guardarServicoEscolhido(id) {
    try {
        window.sessionStorage.setItem(CHAVE_SERVICO, id);
    } catch {
        /* sem armazenamento: segue sem guardar */
    }
}
