// import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
// import { useState } from "react";
import { FiUser, FiPackage, FiMapPin, FiPhone, FiLock, FiLogOut } from "react-icons/fi";

import "../../css/cliente.css";


function Cliente() {

    const navigate = useNavigate();
    const location = useLocation();


    const user = JSON.parse(
        localStorage.getItem("auth") || "{}"
    )?.user || {};


    const isGoogleUser =
        !!user?.google_id;

    function handleLogout() {

        localStorage.removeItem("auth");
        localStorage.removeItem("auth_token");

        navigate("/login", {
            replace: true
        });

    }

    function isActive(path) {
        return location.pathname.startsWith(path);
    }

    return (
        <main className="perfil">
            <div className="perfil-container">

                <aside className="perfil-menu">

                    <button
                        type="button"
                        data-cy="menu-perfil"
                        onClick={() => navigate("/cliente")}
                        className="menu-item"
                    >
                        <FiUser className="menu-icon" />
                        Meu Perfil
                    </button>

                    <button
                        type="button"
                        data-cy="menu-pedidos"
                        onClick={() => navigate("/cliente/pedidos")}
                        className={`menu-item ${isActive("/cliente/pedidos") ? "active" : ""}`}
                    >
                        <FiPackage className="menu-icon" />
                        Meus Pedidos
                    </button>

                    <button
                        type="button"
                        data-cy="menu-enderecos"
                        onClick={() => navigate("/cliente/enderecos")}
                        className={`menu-item ${isActive("/cliente/enderecos") ? "active" : ""}`}
                    >
                        <FiMapPin className="menu-icon" />
                        Endereços
                    </button>

                    <button
                        type="button"
                        data-cy="menu-contatos"
                        onClick={() => navigate("/cliente/contatos")}
                        className={`menu-item ${isActive("/cliente/contatos") ? "active" : ""}`}
                    >
                        <FiPhone className="menu-icon" />
                        Contatos
                    </button>

                    {!isGoogleUser && (
                        <button
                            type="button"
                            data-cy="menu-senha"
                            onClick={() => navigate("/cliente/senha")}
                            className={`menu-item ${isActive("/cliente/senha") ? "active" : ""}`}
                        >
                            <FiLock className="menu-icon" />
                            Alterar Senha
                        </button>
                    )}

                    <button type="button" data-cy="logout" className="menu-item logout" onClick={handleLogout}>
                        <FiLogOut className="menu-icon" />
                        Sair
                    </button>

                </aside>

                <section className="perfil-content">
                    <Outlet />
                </section>

            </div>
        </main >
    );
}

export default Cliente;