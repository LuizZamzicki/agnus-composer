import { Truck } from "lucide-react";
import { FRETE_GRATIS_ACIMA } from "../conteudo/loja";
import { formatarReal } from "../utils/sacola";
import "../css/cliente/conversao.css";

// Quanto falta para o frete grátis (peças a partir de R$ 250, já com desconto).
export default function BarraFreteGratis({ valor }) {
    const pecas = Number(valor || 0);
    const falta = Math.max(0, FRETE_GRATIS_ACIMA - pecas);
    const progresso = Math.min(100, (pecas / FRETE_GRATIS_ACIMA) * 100);
    const ganhou = falta <= 0;

    return (
        <div className={`barra-frete${ganhou ? " is-gratis" : ""}`} data-cy="barra-frete">
            <p>
                <Truck size={18} strokeWidth={1.5} aria-hidden="true" />
                {ganhou ? (
                    <span><strong>Frete grátis</strong> garantido neste pedido.</span>
                ) : (
                    <span>Faltam <strong>{formatarReal(falta)}</strong> para o <strong>frete grátis</strong>.</span>
                )}
            </p>
            <div
                className="barra-frete-trilho"
                role="progressbar"
                aria-label="Caminho até o frete grátis"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progresso)}
            >
                <span style={{ width: `${progresso}%` }} />
            </div>
        </div>
    );
}
