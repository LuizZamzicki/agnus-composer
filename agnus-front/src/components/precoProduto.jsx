import "../css/precoProduto.css";
import { DESCONTO_PIX, PARCELAS_SEM_JUROS } from "../conteudo/loja";

const formatar = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Desconto em % quando o produto tem preço "De" maior que o preço cobrado; senão 0.
export function descontoPercentual(precoOriginal, preco) {
    const de = Number(precoOriginal || 0);
    const por = Number(preco || 0);

    return de > por && por > 0 ? Math.round((1 - por / de) * 100) : 0;
}

// Preço no Pix (a mesma conta do servidor: o desconto arredondado em centavos).
export function valorNoPix(valor) {
    const total = Number(valor || 0);
    const desconto = Math.round(total * DESCONTO_PIX) / 100;
    return Math.round((total - desconto) * 100) / 100;
}

// "R$ X no Pix (5% off)".
export function PrecoPix({ preco, className = "" }) {
    const valor = Number(preco || 0);
    if (!(valor > 0) || !(DESCONTO_PIX > 0)) return null;
    return (
        <span className={`preco-produto__pix ${className}`} data-cy="preco-pix">
            <strong>{formatar(valorNoPix(valor))}</strong> no Pix ({DESCONTO_PIX}% off)
        </span>
    );
}

// "ou 2x de R$ X sem juros" (de 3x em diante o cartão cobra juros).
export function ParcelaProduto({ preco, className = "" }) {
    const valor = Number(preco || 0);
    if (!(valor > 0) || PARCELAS_SEM_JUROS < 2) return null;
    return (
        <span className={`preco-produto__parcela ${className}`} data-cy="parcela-produto">
            ou {PARCELAS_SEM_JUROS}x de {formatar(valor / PARCELAS_SEM_JUROS)} sem juros
        </span>
    );
}

// Mostra "De R$ X por R$ Y" quando há promoção; senão só o preço.
export default function PrecoProduto({ preco, precoOriginal, className = "", destaque = false }) {
    const desconto = descontoPercentual(precoOriginal, preco);

    if (!desconto) {
        return <span className={`preco-produto ${className}`}>{formatar(preco)}</span>;
    }

    return (
        <span className={`preco-produto preco-produto--promo ${destaque ? "preco-produto--destaque" : ""} ${className}`}>
            <span className="preco-produto__selo" aria-label={`Black Friday: ${desconto}% de desconto`}>
                <span className="preco-produto__selo-desconto" aria-hidden="true">−{desconto}%</span>
                <span className="preco-produto__selo-campanha" aria-hidden="true">Black Friday</span>
            </span>
            <span className="preco-produto__de">
                De <s>{formatar(precoOriginal)}</s>
            </span>
            <span className="preco-produto__por">por {formatar(preco)}</span>
        </span>
    );
}
