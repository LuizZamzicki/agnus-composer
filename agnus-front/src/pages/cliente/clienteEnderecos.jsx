import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = process.env.REACT_APP_API_BASE_URL;

function ClienteEnderecos() {
    const [enderecos, setEnderecos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);

    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const [toastById, setToastById] = useState({});

    const [confirmPrincipal, setConfirmPrincipal] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const navigate = useNavigate();

    const estadosBrasil = [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
        "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
        "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
    ];

    const [form, setForm] = useState({
        cep: "",
        logradouro: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        estado: "",
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

    function checkAuth() {
        if (!token || !userId) {
            logout();
            return false;
        }
        return true;
    }

    useEffect(() => {
        if (!checkAuth()) return;
        fetchEnderecos();
        // eslint-disable-next-line
    }, []);

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

    async function fetchEnderecos() {
        try {
            const response = await fetch(`${API_BASE}user-addresses/${userId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (response.status === 401 || response.status === 403) {
                logout();
                return;
            }

            const data = await response.json();
            setEnderecos(data.filter((e) => e.ativo));

        } catch {
            showMessage("error", "Erro ao carregar endereços.");
        } finally {
            setLoading(false);
        }
    }

    function abrirNovo() {
        setEditando(null);
        setForm({
            cep: "",
            logradouro: "",
            numero: "",
            complemento: "",
            bairro: "",
            cidade: "",
            estado: "",
            principal: false,
        });
        setModalOpen(true);
    }

    function abrirEditar(endereco) {
        setEditando(endereco);
        setForm(endereco);
        setModalOpen(true);
    }

    async function handleSave() {
        const camposObrigatorios = ["cep", "logradouro", "numero", "bairro", "cidade", "estado"];

        for (const campo of camposObrigatorios) {
            if (!form[campo]?.trim()) {
                showMessage("error", "Preencha todos os campos obrigatórios.");
                return;
            }
        }

        try {
            const url = editando
                ? `${API_BASE}user-addresses/${editando.id_usuario_endereco}`
                : `${API_BASE}user-addresses`;

            const method = editando ? "PUT" : "POST";

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ...form, id_usuario: userId }),
            });

            if (!response.ok) {
                showMessage("error", "Erro ao salvar endereço.");
                return;
            }

            setModalOpen(false);
            fetchEnderecos();

        } catch {
            showMessage("error", "Erro ao conectar com servidor.");
        }
    }

    async function marcarPrincipal(id) {
        const novosEnderecos = enderecos.map(e => ({
            ...e,
            principal: e.id_usuario_endereco === id
        }));

        setEnderecos(novosEnderecos);

        try {
            await Promise.all(
                novosEnderecos.map(e =>
                    fetch(`${API_BASE}user-addresses/${e.id_usuario_endereco}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ ...e, principal: e.principal }),
                    })
                )
            );

            showToastInCard(id, {
                type: "success",
                text: "Endereço definido como padrão!"
            });

        } catch {
            showToastInCard(id, {
                type: "error",
                text: "Erro ao atualizar endereço."
            });
        }
    }

    async function handleDelete(id) {
        try {
            const response = await fetch(`${API_BASE}user-addresses/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!response.ok) {
                showToastInCard(id, {
                    type: "error",
                    text: "Erro ao excluir endereço."
                });
                return;
            }

            setEnderecos(prev => prev.filter(e => e.id_usuario_endereco !== id));
            setConfirmDelete(null);

        } catch {
            showToastInCard(id, {
                type: "error",
                text: "Erro ao conectar."
            });
        }
    }

    if (loading) return <p>Carregando...</p>;

    return (
        <>
            <div className="enderecos-header">
                <h2>Meus Endereços</h2>
                <button
                    data-cy="novo-endereco"
                    className="btn-novo"
                    onClick={abrirNovo}
                >
                    + Novo endereço
                </button>
            </div>

            <div className="enderecos-grid">
                {enderecos.map((e) => (
                    <div
                        data-cy="endereco-card"
                        key={e.id_usuario_endereco}
                        className={`endereco-card ${e.principal ? "principal" : ""}`}
                        onClick={() => {
                            if (!e.principal) setConfirmPrincipal(e);
                        }}
                    >
                        {e.principal && <span className="badge">Padrão</span>}

                        <h4>{e.principal ? "Principal" : "Endereço"}</h4>

                        <p>{e.logradouro}, {e.numero}</p>
                        <p>{e.bairro} — {e.cidade}</p>
                        <p>{e.estado}</p>
                        <p>CEP: {formatarCEP(e.cep)}</p>

                        {toastById[e.id_usuario_endereco] && (
                            <div className={`toast-card ${toastById[e.id_usuario_endereco].type}`}>
                                {toastById[e.id_usuario_endereco].text}
                            </div>
                        )}

                        <div className="acoes">
                            <span data-cy="editar-endereco" onClick={(ev) => { ev.stopPropagation(); abrirEditar(e); }}>
                                Editar
                            </span>

                            <span data-cy="excluir-endereco" onClick={(ev) => {
                                ev.stopPropagation();
                                setConfirmDelete(e);
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
                        <h3>{editando ? "Editar Endereço" : "Novo Endereço"}</h3>

                        {success && <div className="success-message">{success}</div>}
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>CEP *</label>
                            <input
                                data-cy="cep"
                                placeholder="00000-000"
                                value={form.cep}
                                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>Logradouro *</label>
                            <input
                                data-cy="logradouro"
                                placeholder="Rua, Avenida..."
                                value={form.logradouro}
                                onChange={(e) =>
                                    setForm({ ...form, logradouro: e.target.value })
                                }
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Número *</label>
                                <input
                                    data-cy="numero"
                                    placeholder="123"
                                    value={form.numero}
                                    onChange={(e) =>
                                        setForm({ ...form, numero: e.target.value })
                                    }
                                />
                            </div>

                            <div className="form-group">
                                <label>Bairro *</label>
                                <input
                                    data-cy="bairro"
                                    placeholder="Bairro"
                                    value={form.bairro}
                                    onChange={(e) =>
                                        setForm({ ...form, bairro: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Complemento</label>
                            <input
                                data-cy="complemento"
                                placeholder="Apto, bloco..."
                                value={form.complemento}
                                onChange={(e) =>
                                    setForm({ ...form, complemento: e.target.value })
                                }
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Cidade *</label>
                                <input
                                    data-cy="cidade"
                                    value={form.cidade}
                                    onChange={(e) =>
                                        setForm({ ...form, cidade: e.target.value })
                                    }
                                />
                            </div>

                            <div className="form-group">
                                <label>Estado *</label>
                                <select
                                    data-cy="estado"
                                    value={form.estado}
                                    onChange={(e) =>
                                        setForm({ ...form, estado: e.target.value })
                                    }
                                >
                                    <option value="">Selecione</option>
                                    {estadosBrasil.map((uf) => (
                                        <option key={uf} value={uf}>
                                            {uf}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button onClick={() => setModalOpen(false)} data-cy="cancelar-endereco">
                                Cancelar
                            </button>
                            <button onClick={handleSave} data-cy="salvar-endereco">
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmPrincipal && (
                <div className="modal-overlay">
                    <div className="modal confirm">
                        <h3>Definir como padrão</h3>
                        <p>Deseja tornar este o endereço principal?</p>

                        <div className="modal-actions">
                            <button onClick={() => setConfirmPrincipal(null)} data-cy="cancelar-definir-principal">
                                Cancelar
                            </button>
                            <button onClick={() => {
                                marcarPrincipal(confirmPrincipal.id_usuario_endereco);
                                setConfirmPrincipal(null);
                            }} data-cy="confirmar-definir-principal">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmDelete && (
                <div className="modal-overlay">
                    <div className="modal confirm">
                        <h3>Excluir endereço</h3>
                        <p>Tem certeza que deseja excluir este endereço?</p>

                        <div className="modal-actions">
                            <button onClick={() => setConfirmDelete(null)} data-cy="cancelar-excluir-endereco">
                                Cancelar
                            </button>
                            <button className="danger"
                                onClick={() => handleDelete(confirmDelete.id_usuario_endereco)}>
                                Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function formatarCEP(cep) {
    return cep?.replace(/^(\d{5})(\d{3})$/, "$1-$2");
}

export default ClienteEnderecos;