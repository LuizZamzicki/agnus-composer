import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import emblema from "../img/marca/emblema.png";
import "../css/notFound.css";

function NotFound() {
    const location = useLocation();

    return (
        <main className="nf-container">
            <div className="nf-content">
                <img className="nf-lamb" src={emblema} alt="" />
                <p className="nf-code">404</p>

                <h1>Esta página se perdeu</h1>

                <p className="nf-text">
                    Como a ovelha da parábola, o endereço <code>{location.pathname}</code> saiu
                    do rebanho. Voltemos ao caminho.
                </p>

                <p className="nf-verse">“Alegrai-vos comigo, porque achei a minha ovelha perdida.” <cite>Lucas 15,6</cite></p>

                <div className="nf-actions">
                    <Link to="/" className="btn-agnus">Página inicial</Link>
                    <Link to="/catalogo" className="btn-agnus-ghost">Ver a coleção</Link>
                </div>

                <button type="button" className="nf-back" onClick={() => window.history.back()}>
                    <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /> Voltar à página anterior
                </button>
            </div>
        </main>
    );
}

export default NotFound;
