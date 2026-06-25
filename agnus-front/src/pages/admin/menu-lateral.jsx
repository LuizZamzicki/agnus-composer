import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

import {
  FolderOpen,
  LayoutDashboard,
  List,
  LogOut,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";

function obterMenuAtivo(pathname) {

  if (pathname.startsWith("/admin/dashboard"))
    return "dashboard";

  if (pathname.startsWith("/admin/usuarios"))
    return "usuarios";

  if (pathname.startsWith("/admin/categorias"))
    return "produtos-categoria";

  if (pathname.startsWith("/admin/pedidos"))
    return "pedidos";

  return "produtos-listar";
}

function caminhoPorMenu(menu) {
  switch (menu) {

    case "dashboard":
      return "/admin/dashboard";

    case "usuarios":
      return "/admin/usuarios";

    case "produtos-listar":
      return "/admin/produtos";

    case "produtos-categoria":
      return "/admin/categorias";

    case "pedidos":
      return "/admin/pedidos";

    default:
      return "/admin/produtos";
  }
}

function AdminMenuLateral() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeMenu = obterMenuAtivo(location.pathname);
  // const [expandedMenu, setExpandedMenu] = useState("produtos");
  const [expandedMenu, setExpandedMenu] = useState(null);

  useEffect(() => {

    setExpandedMenu("produtos");

  }, []);

  function irParaMenu(menu) {
    navigate(caminhoPorMenu(menu));
  }

  function toggleProdutos() {

    setExpandedMenu(prev =>
      prev === "produtos"
        ? null
        : "produtos"
    );

  }

  function handleLogout() {
    localStorage.removeItem("auth");
    localStorage.removeItem("token");
    localStorage.removeItem("auth_token");

    navigate("/login", { replace: true });
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__header">
        <div className="admin-sidebar__logo">
          <Link
            to="/"
            className="retorna-Home"
          >
            ←
          </Link>
        </div>

        <h3>Agnus Admin</h3>

      </div>

      <nav className="admin-sidebar__nav">
        <button
          data-cy="menu-dashboard"
          className={
            `admin-nav-item ${activeMenu === "dashboard"
              ? "active" : ""
            }`
          }
          onClick={() => irParaMenu("dashboard")}
        >

          <LayoutDashboard size={20} />
          <span>
            Dashboard
          </span>
        </button>

        <button
          data-cy="menu-usuarios"
          className={
            `admin-nav-item ${activeMenu === "usuarios"
              ? "active" : ""
            }`
          }
          onClick={() => irParaMenu("usuarios")}
        >

          <Users size={20} />

          <span>
            Usuarios
          </span>

        </button>

        <div className="admin-nav-group">

          <button
            data-cy="menu-produtos"

            className={
              `admin-nav-item ${activeMenu?.startsWith("produtos")
                ? "active"
                : ""
              }`
            }

            onClick={toggleProdutos}

          >

            <Package size={20} />

            <span>
              Produtos
            </span>

            <span>
              &gt;
            </span>

          </button>

          {
            expandedMenu === "produtos" && (

              <div className="admin-nav-submenu">

                <button
                  data-cy="submenu-listar-produtos"
                  className={`admin-nav-subitem ${activeMenu === "produtos-listar" ? "active" : ""}`}
                  onClick={() => irParaMenu("produtos-listar")}
                >
                  <List size={18} />
                  <span>
                    Listar Produtos
                  </span>
                </button>


                <button
                  data-cy="submenu-categorias"
                  className={`admin-nav-subitem ${activeMenu === "produtos-categoria" ? "active" : ""}`}
                  onClick={() => irParaMenu("produtos-categoria")}
                >

                  <FolderOpen size={18} />

                  <span>
                    Categoria
                  </span>

                </button>

              </div>
            )
          }
        </div>

        <button
          data-cy="menu-pedidos"
          className={
            `admin-nav-item ${activeMenu === "pedidos"
              ? "active" : ""
            }`
          }
          onClick={() => irParaMenu("pedidos")}
        >
          <ShoppingCart size={20} />

          <span>
            Pedidos
          </span>

        </button>

      </nav>

      <div className="admin-sidebar__footer">

        <button
          data-cy="menu-logout"

          className="admin-nav-item logout"

          onClick={handleLogout}

        >

          <LogOut size={20} />

          <span>
            Sair
          </span>

        </button>
      </div>
    </aside>
  )
}

export default AdminMenuLateral;
