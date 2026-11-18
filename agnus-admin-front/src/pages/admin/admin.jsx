import "../../css/admin-layout.css";
import "../../css/admin-produtos.css";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AdminDashboard from "./dashboard";
import AdminProdutoCadastro from "./produto-cadastro";
import AdminProdutoLista from "./produto-lista";
import AdminMenuLateral from "./menu-lateral";
import AdminCategoriaLista from "./categoria-lista";
import AdminPedidoLista from "./pedido-lista";
import AdminDevolucaoLista from "./devolucao-lista";
import AdminAfiliadoLista from "./afiliado-lista";
import AdminRegistroEventos from "./registro-eventos";
import AdminUsuarioLista from "./usuario-lista";

function Admin() {

  const navigate = useNavigate();
  const location = useLocation();

  const pathname = location.pathname;

  const isDashboard = pathname.startsWith("/admin/dashboard");
  const isUsuarios = pathname.startsWith("/admin/usuarios");
  const isCategorias = pathname.startsWith("/admin/categorias");
  const isPedidos = pathname.startsWith("/admin/pedidos");
  const isDevolucoes = pathname.startsWith("/admin/devolucoes");
  const isAfiliados = pathname.startsWith("/admin/afiliados");
  const isEventos = pathname.startsWith("/admin/eventos");

  const isProdutos =
    pathname.startsWith("/admin/produtos") ||
    pathname === "/admin";

  const isProdutoCadastro =
    pathname.startsWith("/admin/produtos/cadastrar") ||
    pathname.startsWith("/admin/produtos/editar/");


  useEffect(() => {

    const rotaConhecida =
      pathname === "/admin" ||
      isDashboard ||
      isUsuarios ||
      isCategorias ||
      isPedidos ||
      isDevolucoes ||
      isAfiliados ||
      isEventos ||
      isProdutos;


    if (!rotaConhecida || pathname === "/admin") {
      navigate("/admin/produtos", { replace: true });
    }

  }, [
    pathname,
    isDashboard,
    isUsuarios,
    isCategorias,
    isPedidos,
    isDevolucoes,
    isAfiliados,
    isEventos,
    isProdutos,
    navigate
  ]);


  const pageTitle =
    isDashboard
      ? "Dashboard"
      : isUsuarios
        ? "Usuários"
        : isCategorias
          ? "Categoria de Produtos"
          : isPedidos
            ? "Pedidos"
            : isDevolucoes
              ? "Devoluções"
              : isAfiliados
                ? "Programa de afiliados"
                : isEventos
                  ? "Registro de eventos"
                  : "Produtos";


  return (
    <div
      className="admin-dashboard"
      data-cy="admin-page"
    >

      <AdminMenuLateral />

      <main
        className="admin-main"
        data-cy="admin-content"
      >

        <header className="admin-header">
          <div className="admin-header__title">
            <h1 data-cy="admin-title">
              {pageTitle}
            </h1>
          </div>
        </header>

        <section
          className="admin-content"
          data-cy="admin-section">

          {isDashboard && (<AdminDashboard />)}

          {isUsuarios && (<AdminUsuarioLista />)}

          {isProdutos && !isProdutoCadastro && (<AdminProdutoLista />)}

          {isProdutos && isProdutoCadastro && (<AdminProdutoCadastro />)}

          {isCategorias && (<AdminCategoriaLista />)}

          {isPedidos && (<AdminPedidoLista />)}

          {isDevolucoes && (<AdminDevolucaoLista />)}

          {isAfiliados && (<AdminAfiliadoLista />)}

          {isEventos && (<AdminRegistroEventos />)}

        </section>

      </main>

    </div>

  );

}

export default Admin;
