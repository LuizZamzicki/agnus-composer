import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import "../css/login.css";
import hero from "../img/hero.png";
import logoCompleto from "../img/marca/logo-completo.png";
import logoCompletoEscuro from "../img/marca/logo-completo-escuro.png";
import { apiUrl } from "../utils/api";
import { destinoSeguro } from "../utils/destinoSeguro";
import { evaluatePasswordStrength } from "../utils/passwordStrength";

// O Google só devolve para /login, então o destino fica guardado durante a ida e a volta.
const CHAVE_DESTINO = "agnus_destino_login";
// Prova que foi este navegador que começou o login: sem ela, um link com ?token= trocaria a sessão.
const CHAVE_NONCE = "agnus_nonce_login";

function Login() {
  const navigate = useNavigate();

  // O painel é outro site: só a navegação completa do navegador chega nele.
  const irParaDestino = (destino) => {
    if (destino === "/admin") {
      window.location.replace(destino);
      return;
    }

    navigate(destino, { replace: true });
  };
  const [searchParams] = useSearchParams();

  const [modoCadastro, setModoCadastro] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [senhaForca, setSenhaForca] = useState(null);

  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    nome: "",
    email: "",
    cpf: "",
    senha: "",
    confirmarSenha: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    let { name, value } = e.target;

    if (name === "senha") {
      setSenhaForca(value ? evaluatePasswordStrength(value) : null);
    }

    if (name === "cpf") {
      value = formatarCPF(value);
    }

    setError("");
    setForm({ ...form, [name]: value });
  }

  function parseJwt(token) {
    try {
      if (!token) return {};
      const base64Url = token.split(".")[1];
      if (!base64Url) return {};
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(base64));
    } catch {
      return {};
    }
  }

  useEffect(() => {
    const token = searchParams.get("token");
    const tipo = searchParams.get("tipo");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (!token) {
      console.log("Token não encontrado na URL");
    }

    if (!tipo) {
      console.log("Tipo não encontrado na URL");
    }

    if (token && tipo) {
      try {
        const nonceEsperado = sessionStorage.getItem(CHAVE_NONCE);

        if (!nonceEsperado || searchParams.get("nonce") !== nonceEsperado) {
          setError("Não foi possível confirmar este login. Tente entrar novamente.");
          navigate("/login", { replace: true });
          return;
        }

        sessionStorage.removeItem(CHAVE_NONCE);

        const payload = parseJwt(token);

        if (!payload?.id_usuario) {
          setError("Erro ao autenticar com Google.");
          return;
        }

        localStorage.setItem("auth_token", token);

        localStorage.setItem(
          "auth",
          JSON.stringify({
            token,
            ...payload,
            tipo,
            user: payload
          })
        );

        const redirect =
          destinoSeguro(searchParams.get("redirect")) ||
          destinoSeguro(sessionStorage.getItem(CHAVE_DESTINO));

        sessionStorage.removeItem(CHAVE_DESTINO);

        const destino =
          tipo === "administrador"
            ? "/admin"
            : redirect || "/";

        irParaDestino(destino);

      } catch (err) {
        console.error(err);
        setError("Erro ao autenticar com Google.");
      }
    } else {
      console.log("Login Google não detectado nessa URL.");
    }
  }, [searchParams, navigate]);

  function formatarCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;

    let soma = 0;
    let resto;

    for (let i = 1; i <= 9; i++)
      soma += parseInt(cpf.substring(i - 1, i)) * (11 - i);

    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++)
      soma += parseInt(cpf.substring(i - 1, i)) * (12 - i);

    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;

    return resto === parseInt(cpf.substring(10, 11));
  }

  function validarEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (modoCadastro) {
        if (!validarCPF(form.cpf)) {
          setError("CPF inválido.");
          setLoading(false);
          return;
        }

        if (!validarEmail(form.email)) {
          setError("Email inválido.");
          setLoading(false);
          return;
        }

        if (form.senha !== form.confirmarSenha) {
          setError("As senhas não coincidem.");
          setLoading(false);
          return;
        }

        if (!senhaForca?.isValid) {
          setError("A senha não atende os requisitos mínimos.");
          setLoading(false);
          return;
        }

        const response = await fetch(apiUrl("users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nome: form.nome,
            email: form.email,
            cpf: form.cpf.replace(/\D/g, ""),
            senha: form.senha,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data?.message || "Erro no cadastro.");
          setLoading(false);
          return;
        }

        // Quem acabou de criar a conta segue direto, sem digitar tudo de novo.
        const entrada = await fetch(apiUrl("auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: form.email, senha: form.senha }),
        }).catch(() => null);
        const sessao = entrada?.ok ? await entrada.json().catch(() => null) : null;
        const tokenNovo = sessao?.token || sessao?.access_token || sessao?.accessToken;

        if (tokenNovo) {
          localStorage.setItem("auth", JSON.stringify(sessao));
          localStorage.setItem("auth_token", tokenNovo);
          navigate(destinoSeguro(searchParams.get("redirect")) || "/", { replace: true });
          return;
        }

        setSuccess("Cadastro realizado com sucesso!");

        setForm({
          nome: "",
          email: form.email,
          cpf: "",
          senha: "",
          confirmarSenha: "",
        });

        setSenhaForca(null);

        setTimeout(() => {
          setModoCadastro(false);
          // setSuccess("");
        }, 1000);
      } else {
        const response = await fetch(apiUrl("auth/login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: form.email,
            senha: form.senha,
          }),
        });

        const data = await response.json().catch(() => ({}));
        const redirect = destinoSeguro(searchParams.get("redirect"));

        if (!response.ok) {
          setError(data?.message || "Credenciais inválidas.");
          setLoading(false);
          return;
        }

        const token =
          data?.token || data?.access_token || data?.accessToken;

        localStorage.setItem("auth", JSON.stringify(data));
        if (token) localStorage.setItem("auth_token", token);

        irParaDestino(data.tipo === "administrador" ? "/admin" : redirect || "/");
      }
    } catch {
      setError("Erro ao conectar com servidor.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    const redirect = searchParams.get("redirect") || "/";

    const nonce = crypto.randomUUID();

    sessionStorage.setItem(CHAVE_DESTINO, redirect);
    sessionStorage.setItem(CHAVE_NONCE, nonce);

    window.location.href =
      apiUrl(`auth/google?redirect=${encodeURIComponent(redirect)}&nonce=${nonce}`);
  }

  return (
    <main className="login">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="back-home-btn"
      >
        <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /> Voltar
      </button>

      <aside className="login-art" aria-hidden="true">
        <div className="login-arch">
          <img src={hero} alt="" />
        </div>
        <blockquote>
          <p>“Glorificai, pois, a Deus no vosso corpo.”</p>
          <cite>1 Coríntios 6,20</cite>
        </blockquote>
      </aside>

      <section className="login-panel">
        <div className="login-brand">
          <h1>
            <img className="so-tema-claro" src={logoCompleto} alt="Agnus" />
            <img className="so-tema-escuro" src={logoCompletoEscuro} alt="Agnus" />
          </h1>
          <p>
            {searchParams.get("redirect") === "/finalizar"
              ? `${modoCadastro ? "Crie a sua conta" : "Entre na sua conta"} para concluir o pedido. Sua sacola fica guardada.`
              : modoCadastro ? "Crie a sua conta" : "Entre na sua conta"}
          </p>
        </div>

        <div className="login-tabs">
          <button
            className={!modoCadastro ? "active" : ""}
            onClick={() => {
              setModoCadastro(false);
              setError("");
            }}
          >
            Login
          </button>
          <button
            className={modoCadastro ? "active" : ""}
            onClick={() => {
              setModoCadastro(true);
              setError("");
            }}
          >
            Cadastro
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {modoCadastro && (
            <>
              <input
                data-cy="nome"
                name="nome"
                placeholder="Seu nome completo"
                onChange={handleChange}
                required
              />
              <input
                data-cy="cpf"
                name="cpf"
                placeholder="CPF"
                value={form.cpf}
                onChange={handleChange}
                required
              />
            </>
          )}

          <input
            data-cy="email"
            type="email"
            name="email"
            placeholder="seu@email.com"
            value={form.email}
            onChange={handleChange}
            required
          />

          <div className="input-group">
            <input
              data-cy="password"
              type={mostrarSenha ? "text" : "password"}
              name="senha"
              placeholder="Senha"
              value={form.senha}
              onChange={handleChange}
              required
            />

            <button
              type="button"
              className="password-toggle"
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              onClick={() => setMostrarSenha(!mostrarSenha)}
            >
              {mostrarSenha ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
            </button>
          </div>

          {modoCadastro && senhaForca && (
            <div className="senha-forca-box">

              <div className="senha-bar-wrapper">
                <div
                  className={`senha-bar ${senhaForca.label}`}
                  style={{ width: `${senhaForca.percentage}%` }}
                />
              </div>

              <small className="forca-texto">
                Força: {senhaForca.label.replace("_", " ")}
              </small>

              {senhaForca.checks.some(
                (check) => !check.passed && check.id !== "longLength"
              ) && (
                  <ul className="senha-checks">
                    {senhaForca.checks
                      .filter(
                        (check) =>
                          !check.passed &&
                          check.id !== "longLength"
                      )
                      .map((check) => (
                        <li key={check.id} className="erro">
                          {check.label}
                        </li>
                      ))}
                  </ul>
                )}

              {senhaForca.isValid && (
                <div className="senha-ok">
                  Senha atende todos os requisitos.
                </div>
              )}
            </div>
          )}

          {modoCadastro && (
            <div className="input-group">
              <input
                data-cy="confirm-password"
                type={mostrarConfirmarSenha ? "text" : "password"}
                name="confirmarSenha"
                placeholder="Confirmar senha"
                onChange={handleChange}
                required
              />

              <button
                type="button"
                className="password-toggle"
                aria-label={mostrarConfirmarSenha ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
              >
                {mostrarConfirmarSenha ? <EyeOff size={18} strokeWidth={1.5} /> : <Eye size={18} strokeWidth={1.5} />}
              </button>
            </div>
          )}

          {success && <div className="success-message">{success}</div>}
          {error && <div data-cy="error" className="error-message">{error}</div>}

          <button
            data-cy="submit-login"
            type="submit"
            disabled={loading}
          >
            {loading ? "Carregando..." : modoCadastro ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <div className="login-divider">
          <span>ou</span>
        </div>

        <button type="button" className="google-btn" onClick={handleGoogleLogin}>
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            alt=""
          />
          Continuar com Google
        </button>

        <div className="switch-mode">
          {modoCadastro ? "Já tem conta?" : "Não tem conta?"}
          <button type="button" onClick={() => setModoCadastro(!modoCadastro)}>
            {modoCadastro ? "Entrar" : "Criar conta"}
          </button>
        </div>
      </section>
    </main>
  );
}

export default Login;
