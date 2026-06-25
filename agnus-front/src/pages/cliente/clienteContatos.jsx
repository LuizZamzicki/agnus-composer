import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

function ClienteContatos() {
    const [contatos, setContatos] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);

    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const [toastById, setToastById] = useState({});

    const [confirmPrincipal, setConfirmPrincipal] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const navigate = useNavigate();

    const [form, setForm] = useState({
        tipo: "celular",
        valor: "",
        principal: false,
    });

    const token = localStorage.getItem("auth_token");
    const auth = JSON.parse(localStorage.getItem("auth") || "{}");
    const userId = auth?.id_usuario || auth?.user?.id_usuario;

    function logout() {
        localStorage.removeItem("auth");
        localStorage.removeItem("auth_token");
        navigate("/login");
    }

    useEffect(() => {
        if (!token || !userId) {
            logout();
            return;
        }

        fetchContatos();
    }, [token, userId]);

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

    function showToastInCard(id, data) {
        setToastById(prev => ({
            ...prev,
            [id]: data
        }));

        setTimeout(() => {
            setToastById(prev => ({
                ...prev,
                [id]: null
            }));
        }, 3000);
    }

    async function fetchContatos() {
        try {
            const res = await fetch(`${API_BASE}user-contacts/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.status === 401 || res.status === 403) {
                logout();
                return;
            }

            const data = await res.json();
            setContatos(data);
        } catch {
            showMessage("error", "Erro ao carregar contatos.");
        } finally {
            setLoading(false);
        }
    }

    function abrirNovo() {
        setEditando(null);
        setForm({
            tipo: "celular",
            valor: "",
            principal: false,
        });
        setModalOpen(true);
    }

    function abrirEditar(contato) {
        setEditando(contato);
        setForm(contato);
        setModalOpen(true);
    }

    async function handleSave() {
        if (!form.valor.trim()) {
            showMessage("error", "Preencha o valor do contato.");
            return;
        }

        try {
            const url = editando
                ? `${API_BASE}user-contacts/${editando.id_usuario_contato}`
                : `${API_BASE}user-contacts`;

            const method = editando ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ ...form, id_usuario: userId })
            });

            if (res.status === 401 || res.status === 403) {
                logout();
                return;
            }

            if (!res.ok) {
                showMessage("error", "Erro ao salvar contato.");
                return;
            }

            setModalOpen(false);
            fetchContatos();

        } catch {
            showMessage("error", "Erro ao conectar com servidor.");
        }
    }

    async function marcarPrincipal(id) {
        const novos = contatos.map(c => ({
            ...c,
            principal: c.id_usuario_contato === id
        }));

        setContatos(novos);

        try {
            await Promise.all(
                novos.map(c =>
                    fetch(`${API_BASE}user-contacts/${c.id_usuario_contato}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ ...c, principal: c.principal })
                    })
                )
            );

            showToastInCard(id, {
                type: "success",
                text: "Contato definido como principal!"
            });

        } catch {
            showToastInCard(id, {
                type: "error",
                text: "Erro ao atualizar"
            });
        }
    }

    async function handleDelete(id) {
        try {
            const res = await fetch(`${API_BASE}user-contacts/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.status === 401 || res.status === 403) {
                logout();
                return;
            }

            if (!res.ok) {
                showToastInCard(id, {
                    type: "error",
                    text: "Erro ao excluir"
                });
                return;
            }

            setContatos(prev =>
                prev.filter(c => c.id_usuario_contato !== id)
            );

            setConfirmDelete(null);

        } catch {
            showToastInCard(id, {
                type: "error",
                text: "Erro de conexão"
            });
        }
    }

    if (loading) return <p>Carregando...</p>;

    return (
        <>
            <div className="enderecos-header">
                <h2>Meus Contatos</h2>
                <button data-cy="novo-contato" className="btn-novo" onClick={abrirNovo}>
                    + Novo contato
                </button>
            </div>

            <div className="enderecos-grid">
                {contatos.map(c => (
                    <div
                        key={c.id_usuario_contato}
                        data-cy="contato-card"
                        className={`endereco-card ${c.principal ? "principal" : ""}`}
                        onClick={() => {
                            if (!c.principal) setConfirmPrincipal(c);
                        }}
                    >
                        {c.principal && <span className="badge">Principal</span>}

                        <h4>{formatarTipo(c.tipo)}</h4>
                        <p>{c.valor}</p>

                        {toastById[c.id_usuario_contato] && (
                            <div className={`toast-card ${toastById[c.id_usuario_contato].type}`}>
                                {toastById[c.id_usuario_contato].text}
                            </div>
                        )}

                        <div className="acoes">
                            <span data-cy="editar-contato" onClick={(e) => {
                                e.stopPropagation();
                                abrirEditar(c);
                            }}>
                                Editar
                            </span>

                            <span data-cy="excluir-contato" onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(c);
                            }}>
                                Excluir
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {modalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>{editando ? "Editar Contato" : "Novo Contato"}</h3>

                        {success && <div className="success-message">{success}</div>}
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>Tipo *</label>
                            <select
                                data-cy="tipo-contato"
                                value={form.tipo}
                                onChange={(e) => setForm({ ...form, tipo: e.target.value, valor: "" })}
                            >
                                <option value="celular">Celular</option>
                                <option value="telefone">Telefone</option>
                                <option value="email">Email</option>
                                <option value="outro">Outro</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Valor *</label>
                            <input
                                placeholder={
                                    form.tipo === "email"
                                        ? "seu@email.com"
                                        : form.tipo === "telefone"
                                            ? "(00) 0000-0000"
                                            : form.tipo === "celular"
                                                ? "(00) 00000-0000"
                                                : "Digite o contato"
                                }
                                data-cy="valor-contato"
                                value={form.valor}
                                onChange={(e) => {
                                    let val = e.target.value;

                                    if (form.tipo === "celular") {
                                        val = val.replace(/\D/g, "").slice(0, 11);
                                        val = val.replace(/^(\d{2})(\d{5})(\d{0,4})$/, "($1) $2-$3").replace(/-$/, "");
                                    } else if (form.tipo === "telefone") {
                                        val = val.replace(/\D/g, "").slice(0, 10);
                                        val = val.replace(/^(\d{2})(\d{4})(\d{0,4})$/, "($1) $2-$3").replace(/-$/, "");
                                    }

                                    setForm({ ...form, valor: val });
                                }}
                            />
                        </div>

                        <div className="modal-actions">
                            <button data-cy="cancelar-contato" onClick={() => setModalOpen(false)}>
                                Cancelar
                            </button>
                            <button
                                data-cy="salvar-contato"
                                onClick={() => {
                                    if (!form.valor.trim()) {
                                        showMessage("error", "Preencha o valor do contato.");
                                        return;
                                    }
                                    handleSave();
                                }}
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmPrincipal && (
                <div className="modal-overlay">
                    <div className="modal confirm">
                        <h3>Definir como principal</h3>
                        <p>Deseja tornar este contato principal?</p>

                        <div className="modal-actions">
                            <button onClick={() => setConfirmPrincipal(null)}>
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    marcarPrincipal(confirmPrincipal.id_usuario_contato);
                                    setConfirmPrincipal(null);
                                }}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="modal-overlay">
                    <div className="modal confirm">
                        <h3>Excluir contato</h3>
                        <p>Tem certeza que deseja excluir?</p>

                        <div className="modal-actions">
                            <button onClick={() => setConfirmDelete(null)}>
                                Cancelar
                            </button>
                            <button
                                data-cy="confirmar-excluir-contato"
                                className="danger"
                                onClick={() => handleDelete(confirmDelete.id_usuario_contato)}
                            >
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function formatarTipo(tipo) {
    const map = {
        celular: "Celular",
        telefone: "Telefone",
        email: "Email",
        outro: "Outro"
    };
    return map[tipo] || tipo;
}

export default ClienteContatos;