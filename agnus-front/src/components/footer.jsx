import "../css/cliente/app.css"
import "../css/cliente/footer.css"
import { Instagram, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import logoCompleto from "../img/marca/logo-completo.png";
import logoCompletoEscuro from "../img/marca/logo-completo-escuro.png";

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-baixo">
                    <div className="footer-desc">
                        <img className="footer-mark so-tema-claro" src={logoCompleto} alt="Agnus" />
                        <img className="footer-mark so-tema-escuro" src={logoCompletoEscuro} alt="Agnus" />
                        <p>
                            Roupas de treino com identidade católica,
                            feitas sob encomenda.
                        </p>
                        <p className="footer-latin">Ecce Agnus Dei</p>
                    </div>

                    <nav className="footer-links" aria-label="Rodapé">
                        <h4>Loja</h4>
                        <Link to="/">Início</Link>
                        <Link to="/catalogo">Coleção</Link>
                        <Link to="/carrinho">Sacola</Link>
                        <Link to="/cliente">Minha conta</Link>
                    </nav>

                    <div className="footer-contato">
                        <h4>Contato</h4>
                        <a href="https://www.instagram.com/agnus.fit/" target="_blank" rel="noreferrer">
                            <Instagram size={18} strokeWidth={1.5} className="ico" aria-hidden="true" /> @agnus.fit
                        </a>
                        <a href="mailto:contato@agnus.fit">
                            <Mail size={18} strokeWidth={1.5} className="ico" aria-hidden="true" /> contato@agnus.fit
                        </a>
                    </div>
                </div>

                <div className="footer-copy">
                    <p>© {new Date().getFullYear()} Agnus. Todos os direitos reservados.</p>
                    <p className="developed">
                        Desenvolvido por Bruno Medeiros e Luiz Zamzicki
                    </p>
                </div>
            </div>
        </footer>
    )
}

export default Footer;
