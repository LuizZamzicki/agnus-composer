import { useEffect, useState } from "react";
import { AVISOS } from "../conteudo/loja";

const INTERVALO_MS = 5000;

// Avisos da faixa do topo (frete, parcelas, campanha). Troca sozinho; para quem prefere menos
// movimento, mostra só o primeiro, parado.
export default function AvisosLoja() {
    const [atual, setAtual] = useState(0);

    useEffect(() => {
        const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduzir || AVISOS.length < 2) return undefined;
        const id = setInterval(() => setAtual((i) => (i + 1) % AVISOS.length), INTERVALO_MS);
        return () => clearInterval(id);
    }, []);

    if (!AVISOS.length) return null;

    return (
        <p className="avisos-loja" data-cy="avisos-loja" aria-live="off">
            <span key={atual} className="avisos-loja-texto">{AVISOS[atual]}</span>
        </p>
    );
}
