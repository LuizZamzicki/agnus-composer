import { Search, User, ShoppingBag, LogOut, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import "../css/cliente/app.css";
import "../css/cliente/header.css";
import escrita from "../img/marca/escrita.png";
import escritaClara from "../img/marca/escrita-clara.png";
import simbolo from "../img/marca/simbolo.png";
import Notificacoes from "./notificacoes";
import { tempoLiturgico } from "../utils/liturgia";
import { alternarTema, temaAtual } from "../utils/tema";
import { EVENTO_SACOLA, encerrarSessao } from "../utils/sacola";
import { contarPecas } from "../utils/loja";

function Header() {
    const navigate = useNavigate();

    const [tema, setTema] = useState(temaAtual);

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

        return "/cliente";
    }

    function logout() {
        encerrarSessao();

        setToken(null);
        setAuth(null);

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
            const total = await contarPecas().catch(() => 0);

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
                        <img className="logo-escrita so-tema-claro" src={escrita} alt="" />
                        <img className="logo-escrita so-tema-escuro" src={escritaClara} alt="" />
                    </Link>
                </div>

                <nav className="opcoes_header" aria-label="Conta e sacola">
                    <button
                        type="button"
                        data-cy="alternar-tema"
                        className="tema-toggle"
                        onClick={() => setTema(alternarTema())}
                        aria-label={tema === "dark" ? "Usar tema claro" : "Usar tema escuro"}
                        title={tema === "dark" ? "Tema claro" : "Tema escuro"}
                    >
                        {tema === "dark" ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
                    </button>

                    <Link to="/catalogo" state={{ focarBusca: true }} aria-label="Buscar peças">
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
                        {pecas > 0 && <span key={pecas} data-cy="sacola-contador" className="sacola-contador">{pecas > 99 ? "99+" : pecas}</span>}
                    </Link>

                    {token && <Notificacoes key={token} />}

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
