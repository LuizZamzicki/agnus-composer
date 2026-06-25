import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiUrl, assetUrl } from "../../utils/api";

function ClientePedidos() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openPedido, setOpenPedido] = useState(null);

    const navigate = useNavigate();

    const token = localStorage.getItem("auth_token");
    const auth = JSON.parse(localStorage.getItem("auth") || "{}");
    const userId = auth?.id_usuario || auth?.user?.id_usuario;

    function logout() {
        localStorage.removeItem("auth");
        localStorage.removeItem("auth_token");
        navigate("/login");
    }

    useEffect(() => {
        async function fetchPedidos() {
            if (!token || !userId) {
                logout();
                return;
            }

            try {
                const resPedidos = await fetch(apiUrl("orders"), {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (resPedidos.status === 401 || resPedidos.status === 403) {
                    logout();
                    return;
                }

                const pedidosData = await resPedidos.json();

                if (!resPedidos.ok) {
                    throw new Error("Erro ao carregar pedidos.");
                }

                const meusPedidos = pedidosData.filter(
                    (p) => p.id_usuario === userId
                );

                const pedidosComItens = await Promise.all(
                    meusPedidos.map(async (pedido) => {
                        try {
                            const resItens = await fetch(
                                apiUrl(`order-items/${pedido.id_pedido}`),
                                {
                                    headers: { Authorization: `Bearer ${token}` },
                                }
                            );

                            if (resItens.status === 401 || resItens.status === 403) {
                                logout();
                                return { ...pedido, itens: [] };
                            }

                            const itensRaw = await resItens.json();

                            const itens = (Array.isArray(itensRaw) ? itensRaw : itensRaw?.data || []).map(item => ({
                                ...item,
                                img: item.produto?.foto_principal
                                    ? assetUrl(item.produto.foto_principal)
                                    : item.produto?.imagem
                                        ? assetUrl(item.produto.imagem)
                                        : null
                            }));

                            return { ...pedido, itens };

                        } catch {
                            return { ...pedido, itens: [] };
                        }
                    })
                );

                setPedidos(pedidosComItens);

            } catch (err) {
                setError(err.message || "Erro ao conectar com servidor.");
            } finally {
                setLoading(false);
            }
        }

        fetchPedidos();
    }, [token, userId]);

    if (loading) return <p>Carregando pedidos...</p>;

    function togglePedido(id) {
        setOpenPedido(openPedido === id ? null : id);
    }

    return (
        <>
            <h2 data-cy="titulo-pedidos">
                Meus Pedidos
            </h2>
            {error && <div data-cy="erro-pedidos" className="error">{error}</div>}

            {pedidos.length === 0 ? (
                <p>Você ainda não possui pedidos.</p>
            ) : (
                pedidos.map((pedido) => (
                    <div
                        data-cy="pedido-card"
                        key={pedido.id_pedido}
                        className="pedido-card"
                    >
                        <div className="pedido-header">
                            <div
                                data-cy="abrir-pedido"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    cursor: "pointer",
                                }}
                                onClick={() => togglePedido(pedido.id_pedido)}
                            >
                                <strong>Pedido #{pedido.id_pedido}</strong>
                                <span>{formatarData(pedido.data_criacao)}</span>
                                <span
                                    style={{
                                        transform:
                                            openPedido === pedido.id_pedido
                                                ? "rotate(90deg)"
                                                : "rotate(0deg)",
                                        display: "inline-block",
                                        transition: "0.2s",
                                    }}
                                >
                                    ▶
                                </span>
                            </div>

                            <span className={`status ${pedido.status}`}>
                                {pedido.status}
                            </span>

                            <strong className="pedido-valor">
                                R$ {Number(pedido.valor_total).toFixed(2)}
                            </strong>
                        </div>

                        {openPedido === pedido.id_pedido && (
                            <div data-cy="pedido-itens" className="pedido-itens">
                                {pedido.itens.map((item) => (
                                    <div key={item.id_pedido_item} className="item">
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            {item.img && (
                                                <img
                                                    src={item.img}
                                                    alt={item.produto?.nome}
                                                    style={{
                                                        width: 50,
                                                        height: 50,
                                                        objectFit: "cover",
                                                        borderRadius: 8
                                                    }}
                                                />
                                            )}

                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div>
                                                    <p data-cy="item-produto">{item.produto?.nome || "Produto não encontrado"}</p>
                                                    <small>Cor: {item.cor?.nome || "—"}</small>
                                                    <small>Tamanho: {item.grade?.nome || "—"}</small>
                                                    <small>Quantidade: {item.quantidade}</small>
                                                </div>
                                            </div>
                                        </div>

                                        <strong>
                                            R$ {Number(item.subtotal).toFixed(2)}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))
            )}
        </>
    );
}

function formatarData(data) {
    if (!data) return "";
    return new Date(data).toLocaleDateString("pt-BR");
}

export default ClientePedidos;
