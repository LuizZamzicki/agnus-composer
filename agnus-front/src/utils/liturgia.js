// Tempo litúrgico do dia e a cor que o site veste.
// Calendário simplificado do Rito Romano: as festas móveis derivam da Páscoa;
// solenidades isoladas (exceto Pentecostes) não mudam a cor do site.

const TEMPOS = {
    // corEscura: mesma cor, mais clara, para o tema escuro (contraste de 4,8:1 ou mais sobre --paper).
    advento: { nome: "Advento", cor: "#5b3a86", corEscura: "#a587cd" },
    natal: { nome: "Tempo do Natal", cor: "#7a5c17", corEscura: "#be8e1f" },
    comum: { nome: "Tempo Comum", cor: "#2f6a46", corEscura: "#47a86d" },
    quaresma: { nome: "Quaresma", cor: "#4e2f6e", corEscura: "#aa87ce" },
    pascoa: { nome: "Tempo Pascal", cor: "#7a5c17", corEscura: "#be8e1f" },
    pentecostes: { nome: "Pentecostes", cor: "#a1231c", corEscura: "#e9736d" },
};

const atMidnight = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Algoritmo de Meeus/Jones/Butcher para o domingo de Páscoa (calendário gregoriano).
export function pascoa(ano) {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(ano, mes - 1, dia);
}

// Primeiro domingo do Advento: quarto domingo antes do Natal.
export function inicioAdvento(ano) {
    const natal = new Date(ano, 11, 25);
    const diasAteDomingoAnterior = natal.getDay() === 0 ? 7 : natal.getDay();

    return addDays(natal, -(diasAteDomingoAnterior + 21));
}

// Batismo do Senhor: domingo depois de 6 de janeiro, que encerra o Tempo do Natal.
export function batismoDoSenhor(ano) {
    const epifania = new Date(ano, 0, 6);

    return addDays(epifania, 7 - epifania.getDay());
}

export function tempoLiturgico(data = new Date()) {
    const dia = atMidnight(data);
    const ano = dia.getFullYear();
    const domingoPascoa = pascoa(ano);
    const cinzas = addDays(domingoPascoa, -46);
    const pentecostes = addDays(domingoPascoa, 49);
    const advento = inicioAdvento(ano);

    let chave = "comum";

    if (dia < addDays(batismoDoSenhor(ano), 1) || dia >= new Date(ano, 11, 25)) {
        chave = "natal";
    } else if (dia >= advento) {
        chave = "advento";
    } else if (dia >= cinzas && dia < domingoPascoa) {
        chave = "quaresma";
    } else if (dia.getTime() === pentecostes.getTime()) {
        chave = "pentecostes";
    } else if (dia >= domingoPascoa && dia < pentecostes) {
        chave = "pascoa";
    }

    return { chave, ...TEMPOS[chave] };
}

// Aplica a cor do tempo como variável CSS global; todo o site lê --lit.
export function aplicarTempoLiturgico(data = new Date(), root = document.documentElement) {
    const tempo = tempoLiturgico(data);

    root.style.setProperty("--lit-claro", tempo.cor);
    root.style.setProperty("--lit-escuro", tempo.corEscura);
    root.dataset.tempo = tempo.chave;

    return tempo;
}
