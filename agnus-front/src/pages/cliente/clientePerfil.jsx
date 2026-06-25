import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../../utils/api";

function ClientePerfil() {
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(true);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [saving, setSaving] = useState(false);
    const [originalNome, setOriginalNome] = useState("");

    const navigate = useNavigate();

    const token = localStorage.getItem("auth_token");
    const auth = JSON.parse(localStorage.getItem("auth") || "{}");

    const userId =
        auth?.id_usuario ||
        auth?.user?.id_usuario ||
        auth?.user?.id;

    function logout() {
        localStorage.removeItem("auth");
        localStorage.removeItem("auth_token");
        navigate("/login");
    }

    function handleAuthError(response) {
        if (response.status === 401 || response.status === 403) {
            logout();
            return true;
        }
        return false;
    }

    function showMessage(type, msg) {
        if (type === "success") {
            setSuccess(msg);
            setError("");
        } else {
            setError(msg);
            setSuccess("");
        }

        setTimeout(() => {
            setSuccess("");
            setError("");
        }, 3000);
    }

    useEffect(() => {
        async function fetchUser() {
            if (!token || !userId) {
                logout();
                return;
            }

            try {
                const response = await fetch(apiUrl(`users/${userId}`), {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (handleAuthError(response)) return;

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    showMessage("error", data?.message || "Erro ao carregar dados.");
                    return;
                }

                setUser(data);
                setOriginalNome(data.nome || "");
            } catch {
                showMessage("error", "Erro ao conectar com servidor.");
            } finally {
                setLoading(false);
            }
        }

        fetchUser();
    }, [token, userId]);

    async function handleSave() {
        const nomeAtual = user.nome?.trim() || "";

        if (!nomeAtual || nomeAtual.length < 3) {
            showMessage("error", "O nome precisa ter pelo menos 3 caracteres.");
            return;
        }

        if (nomeAtual === originalNome) {
            showMessage("error", "Nenhuma alteração foi feita.");
            return;
        }

        setSaving(true);

        try {
            const response = await fetch(apiUrl(`users/${userId}`), {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ nome: nomeAtual }),
            });

            if (handleAuthError(response)) return;

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                showMessage("error", data?.message || "Erro ao salvar.");
                return;
            }

            setOriginalNome(nomeAtual);
            showMessage("success", "Nome atualizado com sucesso!");
        } catch {
            showMessage("error", "Erro ao conectar com servidor.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <p>Carregando...</p>;

    return (
        <>
            <h2 data-cy="titulo-perfil">Dados Pessoais</h2>

            <label>Nome</label>
            <input data-cy="nome-perfil" value={user.nome || ""} onChange={(e) => setUser({ ...user, nome: e.target.value })} />

            <label>Email</label>
            <input data-cy="email-perfil" value={user.email || ""} disabled />

            <label>CPF</label>
            <input data-cy="cpf-perfil" value={user.cpf || ""} disabled />

            {success && <div data-cy="success-message" className="success-message">{success}</div >}
            {error && <div data-cy="error-message" className="error-message">{error}</div>}

            <button
                data-cy="salvar-perfil"
                onClick={handleSave}
                className={saving ? "loading" : ""}
                disabled={
                    saving ||
                    (user.nome?.trim() || "") === (originalNome || "").trim()
                }
            >
                {saving ? "Salvando..." : "Salvar alterações"}
            </button>
        </>
    );
}

export default ClientePerfil;
