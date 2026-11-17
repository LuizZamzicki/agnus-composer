import { useEffect, useState } from "react";
import { BadgeCheck, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { apiUrl, assetUrl } from "../utils/api";
import "../css/cliente/vitrineHome.css";

// Avaliações reais (nota 4 ou 5, de quem recebeu a peça). Sem avaliação boa, a seção não aparece.
export default function Depoimentos() {
    const [lista, setLista] = useState([]);

    useEffect(() => {
        let ativo = true;
        fetch(apiUrl("product-reviews/destaques"))
            .then((r) => (r.ok ? r.json() : { data: [] }))
            .then((j) => ativo && setLista(Array.isArray(j.data) ? j.data : []))
            .catch(() => ativo && setLista([]));
        return () => {
            ativo = false;
        };
    }, []);

    if (!lista.length) return null;

    return (
        <section className="depoimentos" data-cy="depoimentos" aria-labelledby="depoimentos-titulo">
            <h2 id="depoimentos-titulo" className="section-title">Quem veste, conta</h2>
            <ul className="depoimentos-lista">
                {lista.map((d) => (
                    <li key={d.id_avaliacao_produto} className="depoimento" data-cy="depoimento">
                        {d.foto && <img className="depoimento-foto" src={assetUrl(d.foto)} alt={`Foto de ${d.nome} com a peça`} loading="lazy" />}
                        <div className="depoimento-estrelas" aria-label={`Nota ${d.nota} de 5`}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Star key={i} size={15} fill={i <= Math.round(d.nota) ? "var(--brass)" : "var(--line)"} stroke="none" aria-hidden="true" />
                            ))}
                        </div>
                        {d.titulo && <h3>{d.titulo}</h3>}
                        <blockquote>“{d.comentario}”</blockquote>
                        <p className="depoimento-autor">
                            <strong>{d.nome}</strong>
                            <span><BadgeCheck size={14} strokeWidth={1.5} aria-hidden="true" /> Compra verificada</span>
                        </p>
                        <Link className="depoimento-produto" to={`/produto/${d.id_produto}`}>{d.produto}</Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}
