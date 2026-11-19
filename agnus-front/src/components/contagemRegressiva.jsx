import "../css/cliente/conversao.css";
import { useEffect, useState } from "react";

const partes = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return { dias: Math.floor(s / 86400), horas: Math.floor((s % 86400) / 3600), minutos: Math.floor((s % 3600) / 60), segundos: s % 60 };
};

const dois = (n) => String(n).padStart(2, "0");

export const textoQueFalta = (ms) => {
    const { dias, horas, minutos } = partes(ms);
    return dias > 0 ? `${dias}d ${dois(horas)}h ${dois(minutos)}min` : `${dois(horas)}h ${dois(minutos)}min`;
};

const useFalta = (fim) => {
    const alvo = new Date(fim).getTime();
    const [agora, setAgora] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setAgora(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    return alvo - agora;
};

// Contagem até o fim da campanha. "caixas" é a versão do banner (dias, horas, minutos e segundos);
// "texto" é a linha curta da faixa do topo. Quando o prazo acaba, some.
export default function ContagemRegressiva({ fim, rotulo = "Termina em", variante = "caixas" }) {
    const falta = useFalta(fim);

    if (!(falta > 0)) return null;

    if (variante === "texto") {
        return <span data-cy="contagem-texto">{`${rotulo} ${textoQueFalta(falta)}`}</span>;
    }

    const { dias, horas, minutos, segundos } = partes(falta);
    const caixas = [
        ...(dias > 0 ? [[dias, dias === 1 ? "dia" : "dias"]] : []),
        [horas, "h"],
        [minutos, "min"],
        [segundos, "s"],
    ];

    return (
        <div className="contagem" data-cy="contagem" role="timer" aria-label={`${rotulo} ${textoQueFalta(falta)}`}>
            <span className="contagem-rotulo" aria-hidden="true">{rotulo}</span>
            <div className="contagem-caixas" aria-hidden="true">
                {caixas.map(([valor, unidade]) => (
                    <span key={unidade} className="contagem-caixa">
                        <strong>{dois(valor)}</strong>
                        <small>{unidade}</small>
                    </span>
                ))}
            </div>
        </div>
    );
}
