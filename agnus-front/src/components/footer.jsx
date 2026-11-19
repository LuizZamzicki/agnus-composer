import "../css/cliente/app.css"
import "../css/cliente/footer.css"
import { Instagram, Mail, MessageCircle } from "lucide-react";
import { EMAIL, INSTAGRAM, WHATSAPP, linkWhatsApp } from "../conteudo/loja";
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
                        <Link to="/cliente/afiliados">Seja afiliado</Link>
                    </nav>

                    <nav className="footer-links" aria-label="Ajuda" data-cy="footer-ajuda">
                        <h4>Ajuda</h4>
                        <Link to="/duvidas">Perguntas frequentes</Link>
                        <Link to="/trocas-e-devolucoes">Trocas e devoluções</Link>
                        <Link to="/entrega">Entrega e prazos</Link>
                        <Link to="/cliente/pedidos">Rastrear pedido</Link>
                        <Link to="/sobre">Sobre a Agnus</Link>
                        <Link to="/privacidade">Privacidade</Link>
                    </nav>

                    <div className="footer-contato">
                        <h4>Contato</h4>
                        {WHATSAPP.map((w) => (
                            <a key={w.numero} href={linkWhatsApp(w.numero)} target="_blank" rel="noreferrer">
                                <MessageCircle size={18} strokeWidth={1.5} className="ico" aria-hidden="true" /> {w.rotulo}
                            </a>
                        ))}
                        <a href={INSTAGRAM.url} target="_blank" rel="noreferrer">
                            <Instagram size={18} strokeWidth={1.5} className="ico" aria-hidden="true" /> {INSTAGRAM.usuario}
                        </a>
                        <a href={`mailto:${EMAIL}`}>
                            <Mail size={18} strokeWidth={1.5} className="ico" aria-hidden="true" /> {EMAIL}
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
