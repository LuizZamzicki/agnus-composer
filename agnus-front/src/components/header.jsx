import { Search, User, ShoppingBag, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import "../css/cliente/app.css";
import "../css/cliente/header.css";
import escrita from "../img/marca/escrita.png";
import simbolo from "../img/marca/simbolo.png";
import Notificacoes from "./notificacoes";
import { tempoLiturgico } from "../utils/liturgia";
import { EVENTO_SACOLA, avisarSacola, contarPecas, sessaoDeAdmin } from "../utils/sacola";

function Header() {
    const navigate = useNavigate();

    const [token, setToken] = useState(null);
    const [auth, setAuth] = useState(null);

    const [showHeader, setShowHeader] = useState(true);
    const [tempo] = useState(() => tempoLiturgico());
    const [lastScrollY, setLastScrollY] = useState(0);
    const [pecas, setPecas] = useState(0);
    const { pathname } = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (currentScrollY < 50) {
                setShowHeader(true);
            } else if (currentScrollY > lastScrollY) {
                setShowHeader(false);
            } else {
                setShowHeader(true);
            }

            setLastScrollY(currentScrollY);
        };

        window.addEventListener("scroll", handleScroll);

        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    function loadAuth() {
        const t = localStorage.getItem("auth_token");
        const a = localStorage.getItem("auth");

        setToken(t);

        try {
            setAuth(a ? JSON.parse(a) : null);
        } catch {
            setAuth(null);
        }
    }

    function getUserRoute() {
        if (!token) return "/login";

        const tipo = auth?.user?.tipo || auth?.tipo;

        if (String(tipo).toLowerCase() === "administrador") {
            return "/admin";
        }

        return "/cliente";
    }

    function logout() {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth");

        setToken(null);
        setAuth(null);
        avisarSacola();

        navigate("/login");
    }

    useEffect(() => {
        loadAuth();

        window.addEventListener("storage", loadAuth);

        // const interval = setInterval(loadAuth, 1000);

        return () => {
            window.removeEventListener("storage", loadAuth);
            // clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        let ativo = true;

        async function atualizar() {
            const total = sessaoDeAdmin() ? 0 : await contarPecas().catch(() => 0);

            if (ativo) {
                setPecas(total);
            }
        }

        atualizar();
        window.addEventListener(EVENTO_SACOLA, atualizar);

        return () => {
            ativo = false;
            window.removeEventListener(EVENTO_SACOLA, atualizar);
        };
    }, [pathname]);

    return (
        <header className={`header ${showHeader ? "show" : "hide"}`}>
            <div className="header-bar">
                <nav className="menu_header" aria-label="Principal">
                    <Link to="/" className="nav-link">Início</Link>
                    <Link to="/catalogo" className="nav-link">Coleção</Link>
                </nav>

                <div className="logo">
                    <Link className="logoInicio" to="/" aria-label="Agnus, página inicial">
                        <img className="logo-simbolo" src={simbolo} alt="" />
                        <img className="logo-escrita" src={escrita} alt="" />
                    </Link>
                </div>

                <nav className="opcoes_header" aria-label="Conta e sacola">
                    <Link to="/catalogo" aria-label="Buscar peças">
                        <Search size={20} strokeWidth={1.5} />
                    </Link>

                    <Link to={getUserRoute()} aria-label={token ? "Minha conta" : "Entrar"}>
                        <User size={20} strokeWidth={1.5} />
                    </Link>

                    <Link
                        to="/carrinho"
                        className="sacola-link"
                        aria-label={pecas ? `Sacola, ${pecas} ${pecas === 1 ? "peça" : "peças"}` : "Sacola"}
                    >
                        <ShoppingBag size={20} strokeWidth={1.5} />
                        {pecas > 0 && <span data-cy="sacola-contador" className="sacola-contador">{pecas > 99 ? "99+" : pecas}</span>}
                    </Link>

                    {token && !sessaoDeAdmin() && <Notificacoes key={token} />}

                    {token && (
                        <button type="button" className="logout-icon" onClick={logout} aria-label="Sair">
                            <LogOut size={20} strokeWidth={1.5} />
                        </button>
                    )}
                </nav>
            </div>

            <div className="season-strip" data-tempo={tempo.chave}>
                <span className="season-dot" aria-hidden="true" />
                <span>{tempo.nome}</span>
            </div>
        </header>
    );
}

export default Header;
