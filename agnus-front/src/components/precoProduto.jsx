import "../css/precoProduto.css";
import { PARCELAS_SEM_JUROS } from "../conteudo/loja";

const formatar = (valor) =>
    Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Desconto em % quando o produto tem preço "De" maior que o preço cobrado; senão 0.
export function descontoPercentual(precoOriginal, preco) {
    const de = Number(precoOriginal || 0);
    const por = Number(preco || 0);

    return de > por && por > 0 ? Math.round((1 - por / de) * 100) : 0;
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
            <span className="preco-produto__selo">Black Friday -{desconto}%</span>
            <span className="preco-produto__de">
                De <s>{formatar(precoOriginal)}</s>
            </span>
            <span className="preco-produto__por">por {formatar(preco)}</span>
        </span>
    );
}
