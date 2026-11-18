import { Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formatarReal } from "../utils/sacola";

export function Estrelinhas({ media }) {
    const nota = Number(media) || 0;

    return (
        <div className="stars" aria-label={nota ? `Nota ${nota.toFixed(1)} de 5` : "Sem avaliações"}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    size={13}
                    fill={i <= Math.round(nota) ? "var(--brass)" : "var(--line)"}
                    stroke="none"
                />
            ))}
        </div>
    );
}

// Cartão de peça da vitrine (dados já normalizados pelo serviço da loja).
function CartaoProduto({ produto, media, dataCy, indice = null, imagemReserva }) {
    const imgPadrao = produto.imagens[0] || imagemReserva;
    const imgHover = produto.imagens[1] || imgPadrao;
    const trocarPelaReserva = imagemReserva ? (e) => { e.currentTarget.src = imagemReserva; } : undefined;

    return (
        <Link
            data-cy={dataCy}
            className={`product-card${indice === null ? "" : " cartao-entra"}`}
            style={indice === null ? undefined : { "--i": Math.min(indice, 8) }}
            to={`/produto/${produto.handle}`}
        >
            <div className="product-image">
                {imgPadrao && (
                    <img src={imgPadrao} alt={produto.nome} className="img-default" loading="lazy" onError={trocarPelaReserva} />
                )}
                {imgHover && (
                    <img src={imgHover} alt="" aria-hidden="true" className="img-hover" loading="lazy" onError={trocarPelaReserva} />
                )}
            </div>

            <div className="product-info">
                <h3>{produto.nome}</h3>
                <Estrelinhas media={media} />
                <span className="product-price">
                    {produto.precoComparado && (
                        <s className="product-price-de">
                            <span className="sr-only">De </span>{formatarReal(produto.precoComparado)}
                        </s>
                    )}
                    {produto.precoComparado && <span className="sr-only"> por </span>}
                    {formatarReal(produto.preco)}
                </span>
                {!produto.disponivel && <span className="product-esgotado">Esgotada</span>}
            </div>
        </Link>
    );
}

export default CartaoProduto;
