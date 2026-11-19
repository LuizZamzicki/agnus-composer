import { RotateCcw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

// Garantias logo abaixo do botão de compra.
export default function ConfiancaCompra() {
    return (
        <ul className="confianca-compra" data-cy="confianca-compra">
            <li>
                <RotateCcw size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>
                    Devolução em até 7 dias pelo site · <Link to="/trocas-e-devolucoes">como funciona</Link>
                </span>
            </li>
            <li>
                <ShieldCheck size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>Pagamento seguro pelo Mercado Pago</span>
            </li>
        </ul>
    );
}
