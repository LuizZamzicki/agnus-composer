import "../css/cliente/conversao.css";
import { etiquetasDoProduto } from "../utils/vitrineDados";

// Selos sobre a foto do card: "Mais pedida" (3 mais vendidas) e "Novidade" (cadastrada há pouco).
export default function EtiquetasProduto({ produto, maisPedidos }) {
    const etiquetas = etiquetasDoProduto(produto, maisPedidos);
    if (!etiquetas.length) return null;

    return (
        <div className="etiquetas-produto" data-cy="etiquetas-produto">
            {etiquetas.map((e) => (
                <span key={e.tipo} className={`etiqueta etiqueta--${e.tipo}`}>{e.texto}</span>
            ))}
        </div>
    );
}
