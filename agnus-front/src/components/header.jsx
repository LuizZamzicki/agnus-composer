import { Search, User, ShoppingBag, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

import "../css/cliente/app.css";
import "../css/cliente/header.css";
import logo2 from "../img/logoAgnus.png";

function Header() {
    const navigate = useNavigate();

    const [token, setToken] = useState(null);
    const [auth, setAuth] = useState(null);

    const [showHeader, setShowHeader] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

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

    return (
        <header className={`header ${showHeader ? "show" : "hide"}`}>
            <div className="logo">
                <Link className="logoInicio" to="/">
                    <img className="logoAgnusImg" src={logo2} alt="logo" />
                </Link>
            </div>

            <nav className="menu_header">
                <Link to="/" className="nav-link">Home</Link>
                <Link to="/catalogo" className="nav-link">Catálogo</Link>
            </nav>

            <nav className="opcoes_header">
                <Link to="/catalogo">
                    <Search size={22} />
                </Link>

                <Link to={getUserRoute()}>
                    <User size={22} />
                </Link>

                <Link to="/carrinho">
                    <ShoppingBag size={22} />
                </Link>

                {token && (
                    <a className="logout-icon" onClick={logout}>
                        <LogOut size={22} />
                    </a>
                )}
            </nav>
        </header>
    );
}

export default Header;
