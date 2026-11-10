import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Admin from "./pages/admin/admin";
import { destinoDoAcesso } from "./utils/acesso";

// Login e loja ficam em outro site do mesmo domínio: a sessão vem do localStorage compartilhado.
function RequireAdmin({ children }) {
  const destino = destinoDoAcesso();

  useEffect(() => {
    if (destino) {
      window.location.replace(destino);
    }
  }, [destino]);

  return destino ? null : children;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <RequireAdmin>
            <Admin />
          </RequireAdmin>
        }
      />
    </Routes>
  );
}
