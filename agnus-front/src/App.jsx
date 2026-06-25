import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Header from "./components/header";
import Footer from "./components/footer";
import Contato from "./pages/contato";
import Home from "./pages/home";
import Admin from "./pages/admin/admin";
import Login from "./pages/login";
import Produtos from "./pages/produtos";
import Produto from "./pages/produto";

function hasAuth() {
  try {
    const token = localStorage.getItem("auth_token");
    const authRaw = localStorage.getItem("auth");
    return Boolean(token || authRaw);
  } catch {
    return false;
  }
}

function hasRole(requiredRole) {
  try {
    const authRaw = localStorage.getItem("auth");
    if (!authRaw) return false;
    const auth = JSON.parse(authRaw);
    return auth.tipo === requiredRole;
  } catch {
    return false;
  }
}

function RequireAdmin({ children }) {
  if (!hasAuth()) {
    return <Navigate to="/login" replace />;
  }
  if (!hasRole("administrador")) {
    return <Navigate to="/home" replace />;
  }
  return children;
}

function App() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <div className={`app ${isAdminPage ? "app--full" : "app--with-header"}`}>
      {!isAdminPage && <Header />}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/home" element={<Home />} />
        <Route path="/contato" element={<Contato />} />
        <Route path="/login" element={<Login />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/produtos/:id" element={<Produto />} />
        <Route
          path="/admin/*"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
      </Routes>

      {!isAdminPage && <Footer />}
    </div>
  );
}

export default App;

