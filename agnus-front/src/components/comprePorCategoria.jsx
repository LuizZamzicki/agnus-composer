import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { apiUrl, assetUrl } from "../utils/api";
import hero from "../img/hero.png";
import "../css/cliente/vitrineHome.css";

// Blocos altos com foto, um por categoria que tem peça à venda (a foto é a da peça mais vendida).
export default function ComprePorCategoria() {
    const [categorias, setCategorias] = useState([]);

    useEffect(() => {
        let ativo = true;
        fetch(apiUrl("vitrine/categorias"))
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((j) => ativo && setCategorias(Array.isArray(j.data) ? j.data.slice(0, 4) : []))
            .catch(() => ativo && setCategorias([]));
        return () => {
            ativo = false;
        };
    }, []);

    if (categorias.length < 2) return null;

    return (
        <section className="compre-categoria" data-cy="compre-categoria" aria-labelledby="compre-categoria-titulo">
            <h2 id="compre-categoria-titulo" className="section-title">Compre por categoria</h2>
            <ul className={`compre-categoria-grade compre-categoria-grade--${categorias.length}`}>
                {categorias.map((c) => (
                    <li key={c.id_categoria}>
                        <Link to={`/catalogo?categoria=${c.id_categoria}`} className="categoria-bloco" data-cy="categoria-bloco">
                            <img src={c.imagem_url ? assetUrl(c.imagem_url) : hero} alt="" loading="lazy" onError={(e) => (e.currentTarget.src = hero)} />
                            <span className="categoria-bloco-texto">
                                <strong>{c.nome}</strong>
                                <small>
                                    {c.total} {c.total === 1 ? "peça" : "peças"} <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                                </small>
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
