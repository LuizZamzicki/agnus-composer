import { ChevronRight } from "lucide-react";
import AvaliacaoForm, { Estrelas } from "../../components/avaliacaoForm";
import { formatarReal } from "../../utils/sacola";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { apiUrl, assetUrl } from "../../utils/api";

const STATUS_PEDIDO = {
    aguardando_calculo_frete: "Calculando o frete",
    aguardando_pagamento: "Aguardando pagamento",
    pago: "Pago",
    enviado: "Enviado",
    entregue: "Entregue",
    cancelado: "Cancelado",
};

function ClientePedidos() {
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [openPedido, setOpenPedido] = useState(null);
    const [minhasAvaliacoes, setMinhasAvaliacoes] = useState({});
    const [itemAvaliando, setItemAvaliando] = useState(null);

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const pedidoDaNotificacao = Number(searchParams.get("pedido")) || null;

    const token = localStorage.getItem("auth_token");
    const auth = JSON.parse(localStorage.getItem("auth") || "{}");
    const userId = auth?.id_usuario || auth?.user?.id_usuario;

    function logout() {
        localStorage.removeItem("auth");
        localStorage.removeItem("auth_token");
        navigate("/login");
    }

    // Vinda de uma notificação: abre o pedido avisado e rola até ele, mesmo que já esteja nesta tela.
    useEffect(() => {
        if (loading || !pedidoDaNotificacao) return;

        setOpenPedido(pedidoDaNotificacao);
        document.getElementById(`pedido-${pedidoDaNotificacao}`)?.scrollIntoView({ block: "start" });
    }, [pedidoDaNotificacao, location.key, loading]);

    async function carregarMinhaAvaliacao(idProduto) {
        try {
            const res = await fetch(apiUrl(`product-reviews/${idProduto}`));
            const lista = res.ok ? await res.json() : [];
            const minha = (Array.isArray(lista) ? lista : []).find(
                (avaliacao) => Number(avaliacao.id_usuario) === Number(userId)
            );

            setMinhasAvaliacoes((atuais) => ({ ...atuais, [idProduto]: minha || null }));
        } catch {
            setMinhasAvaliacoes((atuais) => ({ ...atuais, [idProduto]: null }));
        }
    }

    useEffect(() => {
        async function fetchPedidos() {
            if (!token || !userId) {
                logout();
                return;
            }

            try {
                const resPedidos = await fetch(apiUrl("orders/me"), {
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

                // A API ja devolve apenas os pedidos do usuario do token.
                const meusPedidos = Array.isArray(pedidosData) ? pedidosData : [];

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

                const produtosEntregues = new Set(
                    pedidosComItens
                        .filter((pedido) => pedido.status === "entregue")
                        .flatMap((pedido) => pedido.itens.map((item) => item.produto?.id_produto))
                        .filter(Boolean)
                );

                await Promise.all([...produtosEntregues].map(carregarMinhaAvaliacao));

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
                        id={`pedido-${pedido.id_pedido}`}
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
                                <ChevronRight
                                    size={18}
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                    style={{
                                        transform:
                                            openPedido === pedido.id_pedido
                                                ? "rotate(90deg)"
                                                : "rotate(0deg)",
                                        transition: "0.2s",
                                    }}
                                />
                            </div>

                            <span className={`status ${pedido.status}`}>
                                {STATUS_PEDIDO[pedido.status] || pedido.status}
                            </span>

                            <strong className="pedido-valor">
                                {formatarReal(pedido.valor_total)}
                            </strong>

                            <button
                                type="button"
                                data-cy="ver-pecas"
                                className="pedido-ver-pecas"
                                aria-expanded={openPedido === pedido.id_pedido}
                                onClick={() => togglePedido(pedido.id_pedido)}
                            >
                                {openPedido === pedido.id_pedido ? "Ocultar peças" : `Ver peças (${pedido.itens.length})`}
                            </button>
                        </div>

                        {openPedido === pedido.id_pedido && (
                            <div data-cy="pedido-itens" className="pedido-itens">
                                {pedido.itens.length === 0 && <p>Não foi possível carregar as peças deste pedido.</p>}

                                {pedido.itens.map((item) => {
                                    const idProduto = item.produto?.id_produto;
                                    const minhaAvaliacao = minhasAvaliacoes[idProduto] || null;
                                    const podeAvaliar = pedido.status === "entregue" && idProduto;
                                    const avaliando = itemAvaliando === item.id_pedido_item;

                                    return (
                                        <div key={item.id_pedido_item} className="item-bloco">
                                            <div className="item">
                                                <div className="item-info">
                                                    {item.img && <img src={item.img} alt={item.produto?.nome} className="item-foto" />}

                                                    <div>
                                                        <p data-cy="item-produto">
                                                            {idProduto
                                                                ? <Link to={`/produto/${idProduto}`}>{item.produto?.nome}</Link>
                                                                : item.produto?.nome || "Produto não encontrado"}
                                                        </p>
                                                        <small>Cor: {item.cor?.nome || "—"}</small>
                                                        <small>Tamanho: {item.grade?.nome || "—"}</small>
                                                        <small>Quantidade: {item.quantidade}</small>
                                                    </div>
                                                </div>

                                                <div className="item-acoes">
                                                    <strong>{formatarReal(item.subtotal)}</strong>

                                                    {podeAvaliar && (
                                                        <>
                                                            {minhaAvaliacao && <Estrelas nota={minhaAvaliacao.nota} />}
                                                            <button
                                                                type="button"
                                                                data-cy="avaliar-peca"
                                                                className="item-avaliar"
                                                                onClick={() => setItemAvaliando(avaliando ? null : item.id_pedido_item)}
                                                            >
                                                                {avaliando ? "Cancelar" : minhaAvaliacao ? "Alterar avaliação" : "Avaliar peça"}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {avaliando && (
                                                <AvaliacaoForm
                                                    idProduto={idProduto}
                                                    idUsuario={userId}
                                                    avaliacao={minhaAvaliacao}
                                                    onConcluir={async () => {
                                                        await carregarMinhaAvaliacao(idProduto);
                                                        setItemAvaliando(null);
                                                    }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
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
