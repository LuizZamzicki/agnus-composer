import { Navigate, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { ReactNode, useLayoutEffect } from "react";

import "./css/movimento.css";

import Header from "./components/header";
import Footer from "./components/footer";

import Home from "./pages/cliente/home";
import Catalogo from "./pages/cliente/catalogo";
import Carrinho from "./pages/cliente/carrinho";
import Produto from "./pages/cliente/produto";
import Finalizar from "./pages/cliente/finalizar";
import PedidoConfirmado from "./pages/cliente/pedidoConfirmado";

import Cliente from "./pages/cliente/cliente";
import ClientePerfil from "./pages/cliente/clientePerfil";
import ClientePedidos from "./pages/cliente/clientePedidos";
import ClienteEnderecos from "./pages/cliente/clienteEnderecos";
import ClienteSenha from "./pages/cliente/clienteSenha";
import ClienteContatos from "./pages/cliente/clienteContatos";

import Admin from "./pages/admin/admin";
import Login from "./pages/login";
import NotFound from "./pages/notFound";

function RequireAdmin({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("auth_token");
  const authRaw = localStorage.getItem("auth");

  if (!token || !authRaw) {
    console.error("[RequireAdmin] Missing tokens", {
      hasToken: !!token,
      hasAuth: !!authRaw,
    });
    return <Navigate to="/login" replace />;
  }

  let auth;
  try {
    auth = JSON.parse(authRaw);
  } catch (error) {
    console.error("[RequireAdmin] Invalid auth JSON:", error);
    return <Navigate to="/login" replace />;
  }

  const tipo = auth?.user?.tipo || auth?.tipo || auth?.usuario?.tipo;

  console.log("[RequireAdmin] Auth check:", {
    tipo,
    auth_keys: Object.keys(auth || {}),
    user_keys: Object.keys(auth?.user || {}),
  });

  if (!tipo || String(tipo).toLowerCase() !== "administrador") {
    console.error("[RequireAdmin] User is not admin. Role:", tipo);
    return <Navigate to="/" replace />;
  }

  console.log("[RequireAdmin] ✓ User authenticated as admin");
  return children;
}

// O navegador só volta ao topo ao carregar a página; voltar no histórico mantém a posição.
function VoltarAoTopo() {
  const { pathname } = useLocation();
  const tipoDeNavegacao = useNavigationType();

  useLayoutEffect(() => {
    if (tipoDeNavegacao !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, tipoDeNavegacao]);

  return null;
}

function App() {
  const location = useLocation();

  const hideLayout =
    location.pathname.startsWith("/admin") ||
    location.pathname === "/login";

  // A inicial já tem a sua entrada orquestrada; subrotas da mesma seção não reanimam a página.
  const secao = location.pathname.split("/")[1];
  const animarEntrada = !hideLayout && secao !== "";

  return (
    <div className={`app ${hideLayout ? "app--full" : "app--with-header"}`}>
      <VoltarAoTopo />
      {!hideLayout && <Header />}

      <div key={secao} className={animarEntrada ? "pagina-entrada" : undefined}>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/produtos" element={<Catalogo />} />

        <Route path="/carrinho" element={<Carrinho />} />
        <Route path="/finalizar" element={<Finalizar />} />
        <Route path="/pedido-confirmado/:id" element={<PedidoConfirmado />} />
        <Route path="/produto/:id_produto" element={<Produto />} />

        <Route path="/cliente" element={<Cliente />}>
          <Route index element={<ClientePerfil />} />
          <Route path="pedidos" element={<ClientePedidos />} />
          <Route path="enderecos" element={<ClienteEnderecos />} />
          <Route path="contatos" element={<ClienteContatos />} />
          <Route path="senha" element={<ClienteSenha />} />
        </Route>

        <Route path="/login" element={<Login />} />

        <Route
          path="/admin/*"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </div>

      {!hideLayout && <Footer />}
    </div>
  );
}

export default App;
