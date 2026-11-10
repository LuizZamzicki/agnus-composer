// Devolve para onde mandar quem não pode ver o painel, ou null quando o acesso é permitido.
export function destinoDoAcesso() {
  try {
    const token = localStorage.getItem("auth_token");
    const bruto = localStorage.getItem("auth");

    if (!token && !bruto) {
      return "/login";
    }

    const auth = bruto ? JSON.parse(bruto) : null;

    return (auth?.tipo ?? auth?.user?.tipo) === "administrador" ? null : "/home";
  } catch {
    return "/login";
  }
}
