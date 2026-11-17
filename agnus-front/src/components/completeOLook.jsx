import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl, assetUrl } from "../utils/api";
import PrecoProduto from "./precoProduto";
import EscolhaRapida from "./escolhaRapida";
import "../css/cliente/conversao.css";

// Sugestões na sacola: peças que ainda não estão nela, primeiro de categorias diferentes das
// que o cliente já escolheu (quem leva camiseta vê short e regata).
export const sugerirParaOLook = (catalogo, idsNaSacola, limite = 4) => {
    const naSacola = new Set(idsNaSacola.map(Number));
    const categoriasNaSacola = new Set(catalogo.filter((p) => naSacola.has(p.id_produto)).map((p) => p.id_categoria));
    const fora = catalogo.filter((p) => !naSacola.has(p.id_produto));
    const outras = fora.filter((p) => !categoriasNaSacola.has(p.id_categoria));
    const mesmas = fora.filter((p) => categoriasNaSacola.has(p.id_categoria));
    return [...outras, ...mesmas].slice(0, limite);
};

export default function CompleteOLook({ idsNaSacola, onAdicionado }) {
    const [catalogo, setCatalogo] = useState([]);

    useEffect(() => {
        let ativo = true;
        fetch(apiUrl("products/catalog?page=1&limit=24"))
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((j) => ativo && setCatalogo(Array.isArray(j?.data) ? j.data : []))
            .catch(() => ativo && setCatalogo([]));
        return () => {
            ativo = false;
        };
    }, []);

    const sugestoes = sugerirParaOLook(catalogo, idsNaSacola);
    if (!sugestoes.length) return null;

    return (
        <section className="complete-look" data-cy="complete-look" aria-labelledby="complete-look-titulo">
            <h2 id="complete-look-titulo">Complete o look</h2>
            <p>Peças que combinam com o que você já escolheu.</p>
            <div className="complete-look-grade">
                {sugestoes.map((p) => {
                    const img = p.imagens?.[0] ? assetUrl(p.imagens[0]) : null;
                    return (
                        <div className="cartao-produto" key={p.id_produto} data-cy="sugestao-look">
                            <Link to={`/produto/${p.id_produto}`} className="product-card">
                                <div className="product-image">{img && <img src={img} alt={p.nome} className="img-default" loading="lazy" />}</div>
                                <div className="product-info">
                                    <h3>{p.nome}</h3>
                                    <PrecoProduto className="product-price" preco={p.preco_base} precoOriginal={p.preco_original} />
                                </div>
                            </Link>
                            <EscolhaRapida produto={p} imagem={img} onAdicionado={onAdicionado} />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
