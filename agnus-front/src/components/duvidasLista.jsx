import { Plus } from "lucide-react";
import "../css/cliente/institucional.css";

// Perguntas que abrem e fecham com um clique (details/summary: funciona com teclado e leitor de tela).
export default function DuvidasLista({ perguntas, prefixo = "duvida" }) {
    return (
        <div className="duvidas-lista">
            {perguntas.map((p, i) => (
                <details key={p.pergunta} className="duvida" data-cy={`${prefixo}-${i}`}>
                    <summary>
                        <span>{p.pergunta}</span>
                        <Plus className="duvida-icone" size={18} strokeWidth={1.5} aria-hidden="true" />
                    </summary>
                    <p>{p.resposta}</p>
                </details>
            ))}
        </div>
    );
}
