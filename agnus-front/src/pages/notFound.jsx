import { Link, useLocation } from "react-router-dom";
import "../css/notFound.css";

function NotFound() {
    const location = useLocation();

    return (
        <div className="nf-container">
            <div className="nf-content">

                <h1>404</h1>

                <div className="nf-line"></div>

                <h2>PÁGINA NÃO ENCONTRADA</h2>

                <p>
                    O caminho <span>{location.pathname}</span> não existe.
                    Verifique o endereço ou retorne à página inicial.
                </p>

                <div className="nf-actions">
                    <Link to="/" className="btn-primary404">
                        PÁGINA INICIAL
                    </Link>

                    <Link to="/catalogo" className="btn-outline404">
                        VER CATÁLOGO
                    </Link>
                </div>

                <span
                    className="nf-back"
                    onClick={() => window.history.back()}
                >
                    ← VOLTAR À PÁGINA ANTERIOR
                </span>

            </div>
        </div>
    );
}

export default NotFound;