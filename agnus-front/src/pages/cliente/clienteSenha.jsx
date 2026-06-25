import "../../css/cliente.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../utils/api";
import { evaluatePasswordStrength } from "../../utils/passwordStrength";

function ClienteSenha() {

    const [form, setForm] = useState({
        senhaAtual: "",
        novaSenha: "",
        confirmarSenha: "",
    });

    const [mostrarSenha, setMostrarSenha] = useState({
        atual: false,
        nova: false,
        confirmar: false,
    });

    const [passwordInfo, setPasswordInfo] = useState(null);
    const [toast, setToast] = useState({ msg: "", type: "" });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem("auth_token");
        const auth = JSON.parse(localStorage.getItem("auth") || "{}");
        const userId = auth?.id_usuario || auth?.user?.id_usuario;

        if (!token || !userId) {
            localStorage.removeItem("auth");
            localStorage.removeItem("auth_token");
            navigate("/login");
        }
    }, []);

    function handleChange(e) {
        const { name, value } = e.target;

        setForm({ ...form, [name]: value });

        if (name === "novaSenha") {
            setPasswordInfo(value ? evaluatePasswordStrength(value) : null);
        }
    }

    function showToast(msg, type = "error") {
        setToast({ msg, type });
        setTimeout(() => setToast({ msg: "", type: "" }), 3000);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setToast({ msg: "", type: "" });
        setLoading(true);

        const token = localStorage.getItem("auth_token");
        const auth = JSON.parse(localStorage.getItem("auth") || "{}");
        const userId = auth?.id_usuario || auth?.user?.id_usuario;

        if (!token || !userId) {
            showToast("Usuário inválido. Faça login novamente.");
            localStorage.clear();
            setLoading(false);
            return;
        }

        if (!form.senhaAtual || !form.novaSenha || !form.confirmarSenha) {
            showToast("Preencha todos os campos.");
            setLoading(false);
            return;
        }

        if (form.novaSenha !== form.confirmarSenha) {
            showToast("As senhas não coincidem.");
            setLoading(false);
            return;
        }

        if (!passwordInfo?.isValid) {
            showToast("A senha não atende os requisitos mínimos.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(apiUrl(`users/${userId}/password`), {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    senhaAtual: form.senhaAtual,
                    confirmacaoSenhaAtual: form.senhaAtual,
                    novaSenha: form.novaSenha,
                })
            });

            if (res.status === 401 || res.status === 403) {
                showToast("Sessão expirada.");
                localStorage.clear();
                setTimeout(() => window.location.href = "/login", 2000);
                return;
            }

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                showToast(data?.message || "Erro ao alterar a senha.");
                return;
            }

            showToast("Senha alterada com sucesso!", "success");

            setForm({
                senhaAtual: "",
                novaSenha: "",
                confirmarSenha: ""
            });

            setPasswordInfo(null);

        } catch {
            showToast("Erro de conexão.");
        } finally {
            setLoading(false);
        }
    }

    const senhasCoincidem =
        form.confirmarSenha &&
        form.novaSenha === form.confirmarSenha;

    return (
        <section className="perfil-content">
            <h2 data-cy="titulo-senha">Alterar Senha</h2>

            <form onSubmit={handleSubmit} className="senha-form">

                <div className="input-group">
                    <div className="input-wrapper">
                        <label>Senha Atual *</label>
                        <input
                            data-cy="senha-atual"
                            type={mostrarSenha.atual ? "text" : "password"}
                            placeholder="Digite sua Senha Atual"
                            name="senhaAtual"
                            value={form.senhaAtual}
                            onChange={handleChange}
                            required
                        />
                        <span className="password-toggle2"
                            onClick={() =>
                                setMostrarSenha({ ...mostrarSenha, atual: !mostrarSenha.atual })
                            }>
                            👁️
                        </span>
                    </div>
                </div>

                <div className="input-group">
                    <label>Nova Senha *</label>

                    <div className="input-wrapper">
                        <input
                            data-cy="nova-senha"
                            type={mostrarSenha.nova ? "text" : "password"}
                            placeholder="Digite sua Nova Senha"
                            name="novaSenha"
                            value={form.novaSenha}
                            onChange={handleChange}
                            required
                        />

                        <span
                            className="password-toggle"
                            onClick={() =>
                                setMostrarSenha({ ...mostrarSenha, nova: !mostrarSenha.nova })
                            }
                        >
                            👁️
                        </span>
                    </div>

                    {passwordInfo && (
                        <div className="senha-forca-box">

                            <div className="senha-bar-wrapper">
                                <div
                                    className={`senha-bar ${passwordInfo.label}`}
                                    style={{ width: `${passwordInfo.percentage}%` }}
                                />
                            </div>

                            <small data-cy="forca-senha" className="forca-texto">
                                Força: {passwordInfo.label.replace("_", " ")}
                            </small>

                            {form.confirmarSenha && !senhasCoincidem && (
                                <small className="erro-texto">
                                    As senhas não coincidem
                                </small>
                            )}

                            {passwordInfo.checks.some(
                                (check) => !check.passed && check.id !== "longLength"
                            ) && (
                                    <ul className="senha-checks">
                                        {passwordInfo.checks
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

                            {passwordInfo.isValid && (
                                <div className="senha-ok">
                                    Senha atende todos os requisitos.
                                </div>
                            )}

                        </div>
                    )}
                </div>

                <div className="input-group">
                    <div className="input-wrapper">
                        <label>Confirmar Nova Senha *</label>
                        <input
                            data-cy="confirmar-senha"
                            type={mostrarSenha.confirmar ? "text" : "password"}
                            placeholder="Digite Novamente sua Nova Senha"
                            name="confirmarSenha"
                            value={form.confirmarSenha}
                            onChange={handleChange}
                            required
                        />
                        <span className="password-toggle2"
                            onClick={() =>
                                setMostrarSenha({ ...mostrarSenha, confirmar: !mostrarSenha.confirmar })
                            }>
                            👁️
                        </span>
                    </div>
                </div>

                {toast.msg && (
                    <div data-cy="toast" className={`toast-card ${toast.type}`}>
                        {toast.msg}
                    </div>
                )}

                <button
                    data-cy="alterar-senha"
                    type="submit"
                    disabled={
                        loading ||
                        !form.senhaAtual ||
                        !form.novaSenha ||
                        !form.confirmarSenha ||
                        !passwordInfo?.isValid ||
                        form.novaSenha !== form.confirmarSenha
                    }
                >
                    {loading ? "Alterando..." : "Alterar Senha"}
                </button>

            </form>
        </section>
    );
}

export default ClienteSenha;
