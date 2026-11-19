import { useEffect, useState } from "react";
import { AVISOS } from "../conteudo/loja";
import { campanhaTerminando, useBanners } from "../utils/vitrineDados";
import ContagemRegressiva from "./contagemRegressiva";

const INTERVALO_MS = 5000;

// Avisos da faixa do topo (parcelas, cupom, campanha). Troca sozinho; para quem prefere menos
// movimento, mostra só o primeiro, parado. Campanha terminando nos próximos dias entra primeiro,
// com a contagem regressiva ("Black Friday termina em 2d 05h 10min").
export default function AvisosLoja() {
    const [atual, setAtual] = useState(0);
    const campanha = campanhaTerminando(useBanners());
    const avisos = campanha ? [campanha, ...AVISOS] : AVISOS;
    const total = avisos.length;

    useEffect(() => {
        const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduzir || total < 2) return undefined;
        const id = setInterval(() => setAtual((i) => (i + 1) % total), INTERVALO_MS);
        return () => clearInterval(id);
    }, [total]);

    if (!total) return null;

    const aviso = avisos[atual % total];

    return (
        <p className="avisos-loja" data-cy="avisos-loja" aria-live="off">
            <span key={atual} className="avisos-loja-texto">
                {typeof aviso === "string" ? aviso : <ContagemRegressiva variante="texto" fim={aviso.fim} rotulo={`${aviso.sobretitulo || aviso.titulo} termina em`} />}
            </span>
        </p>
    );
}
