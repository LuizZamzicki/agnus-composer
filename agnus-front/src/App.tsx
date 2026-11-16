import { Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { useLayoutEffect } from "react";

import "./css/movimento.css";

import Header from "./components/header";
import Footer from "./components/footer";

import Home from "./pages/cliente/home";
import Catalogo from "./pages/cliente/catalogo";
import Carrinho from "./pages/cliente/carrinho";
import Produto from "./pages/cliente/produto";
import Finalizar from "./pages/cliente/finalizar";
import PedidoConfirmado from "./pages/cliente/pedidoConfirmado";
import Pagamento from "./pages/cliente/pagamento";

import Cliente from "./pages/cliente/cliente";
import ClientePerfil from "./pages/cliente/clientePerfil";
import ClientePedidos from "./pages/cliente/clientePedidos";
import ClienteEnderecos from "./pages/cliente/clienteEnderecos";
import ClienteSenha from "./pages/cliente/clienteSenha";
import ClienteContatos from "./pages/cliente/clienteContatos";
import ClienteAfiliados from "./pages/cliente/clienteAfiliados";
import TermosAfiliados from "./pages/termosAfiliados";
import Duvidas from "./pages/duvidas";
import { Entrega, Privacidade, Sobre, TrocasDevolucoes } from "./pages/institucional";

import Login from "./pages/login";
import NotFound from "./pages/notFound";

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
        <Route path="/finalizar" element={<Finalizar />} />
        <Route path="/pagamento/:id" element={<Pagamento />} />
        <Route path="/pedido-confirmado/:id" element={<PedidoConfirmado />} />
        <Route path="/produto/:id_produto" element={<Produto />} />

        <Route path="/cliente" element={<Cliente />}>
          <Route index element={<ClientePerfil />} />
          <Route path="pedidos" element={<ClientePedidos />} />
          <Route path="enderecos" element={<ClienteEnderecos />} />
          <Route path="contatos" element={<ClienteContatos />} />
          <Route path="senha" element={<ClienteSenha />} />
          <Route path="afiliados" element={<ClienteAfiliados />} />
        </Route>

        <Route path="/afiliados/termos" element={<TermosAfiliados />} />
        <Route path="/duvidas" element={<Duvidas />} />
        <Route path="/trocas-e-devolucoes" element={<TrocasDevolucoes />} />
        <Route path="/entrega" element={<Entrega />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route path="/sobre" element={<Sobre />} />

        <Route path="/login" element={<Login />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      </div>

      {!hideLayout && <Footer />}
    </div>
  );
}

export default App;
