import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import "../../css/cliente/carrinho.css";
import { apiUrl, assetUrl, authHeaders } from "../../utils/api";
import { EsqueletoLinhas } from "../../components/esqueleto";
import {
    SessaoExpirada,
    avisarSacola,
    encerrarSessao,
    formatarReal,
    lerSacolaVisitante,
    listarItens,
    salvarSacolaVisitante,
    sessaoDeAdmin,
    sincronizarVisitante,
    usuarioDaSessao,
} from "../../utils/sacola";

let toastTimeout;

function formatarItem(item) {
    return {
        ...item,
        id_produto: item.produto?.id_produto,
        nome_produto: item.produto?.nome || "Produto",
        nome_cor: item.cor?.nome || "Cor",
        nome_tamanho: item.grade?.nome || "Tamanho",
        img: item.foto_produto ? assetUrl(item.foto_produto) : null,
        preco_unitario: Number(item.preco_unitario || 0),
    };
}

function Carrinho() {
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [sessaoExpirou, setSessaoExpirou] = useState(false);

    const idUsuario = usuarioDaSessao();
    const isAdmin = sessaoDeAdmin();

    function showToast(message, type = "success") {
        setToast({ message, type });
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => setToast(null), 3000);
    }

    const carregarCarrinho = useCallback(async () => {
        setLoading(true);

        try {
            if (isAdmin) {
                setCart([]);
            } else if (!idUsuario) {
                setCart(lerSacolaVisitante());
            } else {
                await sincronizarVisitante(idUsuario);
                setCart((await listarItens(idUsuario)).map(formatarItem));
            }
        } catch (error) {
            if (error instanceof SessaoExpirada) {
                setSessaoExpirou(true);
                setCart(lerSacolaVisitante());
            } else {
                showToast("Não foi possível carregar a sacola. Tente de novo.", "error");
            }
        } finally {
            setLoading(false);
        }
    }, [idUsuario, isAdmin]);

    useEffect(() => {
        carregarCarrinho();
    }, [carregarCarrinho]);

    function atualizarVisitante(itens) {
        setCart(itens);
        salvarSacolaVisitante(itens);
    }

    async function alterarQtd(item, delta) {
        const quantidade = item.quantidade + delta;

        if (quantidade < 1) {
            return;
        }

        if (!idUsuario) {
            atualizarVisitante(cart.map((p) => (
                p.id_carrinho_item === item.id_carrinho_item ? { ...p, quantidade } : p
            )));
            return;
        }

        try {
            const res = await fetch(apiUrl(`cart-items/${item.id_carrinho_item}`), {
                method: "PUT",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ quantidade }),
            });

            if (res.status === 401) {
                encerrarSessao();
                setSessaoExpirou(true);
                setCart(lerSacolaVisitante());
                return;
            }

            if (!res.ok) {
                showToast("Erro ao atualizar quantidade", "error");
                return;
            }

            setCart((prev) => prev.map((p) => (
                p.id_carrinho_item === item.id_carrinho_item ? { ...p, quantidade } : p
            )));
            avisarSacola();
        } catch {
            showToast("Erro ao atualizar quantidade", "error");
        }
    }

    async function confirmarRemocao() {
        const id = confirmDelete;

        setConfirmDelete(null);

        if (!idUsuario) {
            atualizarVisitante(cart.filter((i) => i.id_carrinho_item !== id));
            return;
        }

        try {
            const res = await fetch(apiUrl(`cart-items/${id}`), {
                method: "DELETE",
                headers: authHeaders(),
            });

            if (!res.ok) {
                showToast("Erro ao remover produto", "error");
                return;
            }

            setCart((prev) => prev.filter((i) => i.id_carrinho_item !== id));
            avisarSacola();
        } catch {
            showToast("Erro ao remover produto", "error");
        }
    }

    const total = cart.reduce((acc, item) => acc + item.preco_unitario * item.quantidade, 0);
    const linkFinalizar = idUsuario ? "/finalizar" : "/login?redirect=/finalizar";

    if (loading) {
        return (
            <div className="cart-empty">
                <EsqueletoLinhas rotulo="Carregando a sua sacola…" />
            </div>
        );
    }

    if (isAdmin) {
        return (
            <div className="cart-empty">
                <h1>Administradores não têm sacola</h1>
                <Link to="/admin" className="empty-btn">Ir para o painel</Link>
            </div>
        );
    }

    if (cart.length === 0) {
        return (
            <div className="cart-empty">
                <span className="cart-empty-icon"><ShoppingBag size={44} strokeWidth={1} aria-hidden="true" /></span>
                {sessaoExpirou ? (
                    <>
                        <h1>Entre de novo para ver a sua sacola</h1>
                        <p>Sua sessão terminou, mas as peças continuam guardadas na sua conta.</p>
                        <Link to="/login?redirect=/carrinho" className="empty-btn">Entrar</Link>
                    </>
                ) : (
                    <>
                        <h1>Sua sacola está vazia</h1>
                        <p>Quando escolher uma peça, ela aparece aqui.</p>
                        <Link to="/catalogo" className="empty-btn">Ver a coleção</Link>
                        {!idUsuario && (
                            <p className="cart-empty-login">
                                Já escolheu antes? <Link to="/login?redirect=/carrinho">Entre na sua conta</Link>
                            </p>
                        )}
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="cart-page">

            {toast && (
                <div data-cy="carrinho-toast" className={`toast ${toast.type}`} role="status">
                    {toast.message}
                </div>
            )}

            {confirmDelete && (
                <div className="modal-overlay">
                    <div className="modal-confirm" role="dialog" aria-modal="true">
                        <h3>Tirar esta peça da sacola?</h3>

                        <div className="modal-actions">
                            <button data-cy="cancelar-remover" onClick={() => setConfirmDelete(null)}>
                                Manter
                            </button>

                            <button data-cy="confirmar-remover" onClick={confirmarRemocao}>
                                Sim, remover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Link to="/catalogo" className="back-link">
                <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /> Continuar escolhendo
            </Link>

            <h1>Sacola</h1>

            <div className="cart-container">
                <div className="cart-items">
                    {cart.map((item) => (
                        <div className="cart-item" key={item.id_carrinho_item}>
                            {item.img && <img src={item.img} alt={item.nome_produto} />}

                            <div className="cart-info">
                                <h3>
                                    {item.id_produto
                                        ? <Link to={`/produto/${item.id_produto}`}>{item.nome_produto}</Link>
                                        : item.nome_produto}
                                </h3>

                                <span>Cor: {item.nome_cor} • Tam: {item.nome_tamanho}</span>

                                <div className="qtd">
                                    <button
                                        data-cy={`diminuir-${item.id_carrinho_item}`}
                                        aria-label="Diminuir quantidade"
                                        disabled={item.quantidade <= 1}
                                        onClick={() => alterarQtd(item, -1)}
                                    >
                                        <Minus size={14} strokeWidth={1.5} />
                                    </button>

                                    <span data-cy={`quantidade-${item.id_carrinho_item}`}>
                                        {item.quantidade}
                                    </span>

                                    <button
                                        data-cy={`aumentar-${item.id_carrinho_item}`}
                                        aria-label="Aumentar quantidade"
                                        onClick={() => alterarQtd(item, 1)}
                                    >
                                        <Plus size={14} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="cart-price">
                                <span>{formatarReal(item.preco_unitario * item.quantidade)}</span>
                                <button
                                    type="button"
                                    className="cart-remove"
                                    data-cy={`remover-${item.id_carrinho_item}`}
                                    aria-label={`Remover ${item.nome_produto}`}
                                    onClick={() => setConfirmDelete(item.id_carrinho_item)}
                                >
                                    <Trash2 size={18} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="cart-summary">
                    <h2>Resumo</h2>
                    <div>
                        <span>Peças</span>
                        <span>{formatarReal(total)}</span>
                    </div>
                    <div>
                        <span>Frete</span>
                        <span className="cart-frete">combinado depois</span>
                    </div>
                    <hr />
                    <div>
                        <strong>Total</strong>
                        <strong data-cy="carrinho-total">{formatarReal(total)}</strong>
                    </div>
                    <Link data-cy="finalizar-compra" className="finish-btn" to={linkFinalizar}>
                        Finalizar pedido
                    </Link>
                    {!idUsuario && (
                        <p className="cart-hint">Na próxima etapa, você entra na sua conta ou cria uma. Sua sacola fica guardada.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Carrinho;
