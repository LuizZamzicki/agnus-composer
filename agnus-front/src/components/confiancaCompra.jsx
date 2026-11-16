import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { FRETE_GRATIS_ACIMA } from "../conteudo/loja";

const real = (valor) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Três garantias logo abaixo do botão de compra.
export default function ConfiancaCompra() {
    return (
        <ul className="confianca-compra" data-cy="confianca-compra">
            <li>
                <Truck size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>Frete grátis acima de {real(FRETE_GRATIS_ACIMA)}</span>
            </li>
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
