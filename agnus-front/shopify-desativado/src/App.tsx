import { Navigate, Route, Routes, useLocation, useNavigationType, useParams } from "react-router-dom";
import { useLayoutEffect } from "react";

import "./css/movimento.css";

import Header from "./components/header";
import Footer from "./components/footer";

import Home from "./pages/cliente/home";
import Catalogo from "./pages/cliente/catalogo";
import Carrinho from "./pages/cliente/carrinho";
import Produto from "./pages/cliente/produto";
import PedidoConfirmado from "./pages/cliente/pedidoConfirmado";

import Cliente from "./pages/cliente/cliente";
import ClientePerfil from "./pages/cliente/clientePerfil";
import ClientePedidos from "./pages/cliente/clientePedidos";
import ClienteEnderecos from "./pages/cliente/clienteEnderecos";
import ClienteSenha from "./pages/cliente/clienteSenha";
import ClienteContatos from "./pages/cliente/clienteContatos";

import Login from "./pages/login";
import NotFound from "./pages/notFound";

// Endereços no formato da loja do Shopify ("Voltar à loja" no checkout, links antigos): o tema do
// Shopify reenvia a visita para cá (docs/shopify/redirecionar-para-o-site.liquid) e cada um cai na
// página equivalente do site.
function PecaDoShopify() {
  const { handle } = useParams();
  return <Navigate to={`/produto/${handle}`} replace />;
}

// O Shopify põe o idioma na frente do caminho ("/pt", "/pt-br/products/x"); o site não usa esse
// prefixo, então tira e segue para a página equivalente.
const IDIOMAS_DO_SHOPIFY = ["pt", "pt-br", "pt-pt", "en", "es"];

function SemIdiomaDoShopify() {
  const { pathname, search } = useLocation();
  // Barras repetidas viram uma só: "/pt//site.externo" nunca pode virar um endereço de outro site.
  const resto = pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?(?=\/|$)/i, "").replace(/^\/+/, "/") || "/";
  return <Navigate to={`${resto}${search}`} replace />;
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

  const hideLayout = location.pathname === "/login";

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
        {/* O pagamento agora é no checkout do Shopify, aberto pela sacola. */}
        <Route path="/finalizar" element={<Navigate to="/carrinho" replace />} />
        {/* O painel administrativo saiu: produtos e pedidos são geridos no admin do Shopify. */}
        <Route path="/admin/*" element={<Navigate to="/cliente" replace />} />
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

        {IDIOMAS_DO_SHOPIFY.map((idioma) => (
          <Route key={idioma} path={`/${idioma}/*`} element={<SemIdiomaDoShopify />} />
        ))}
        <Route path="/products/:handle" element={<PecaDoShopify />} />
        <Route path="/collections/*" element={<Navigate to="/catalogo" replace />} />
        <Route path="/search" element={<Navigate to="/catalogo" replace />} />
        <Route path="/cart" element={<Navigate to="/carrinho" replace />} />
        <Route path="/account/*" element={<Navigate to="/cliente" replace />} />
        <Route path="/pages/*" element={<Navigate to="/" replace />} />
        <Route path="/blogs/*" element={<Navigate to="/" replace />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </div>

      {!hideLayout && <Footer />}
    </div>
  );
}

export default App;
