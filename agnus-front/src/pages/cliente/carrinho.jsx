import { useState, useEffect } from "react";
import { Trash2, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import "../../css/cliente/carrinho.css";
import { apiUrl, assetUrl } from "../../utils/api";

let toastTimeout;

function Carrinho() {
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);

    const [confirmFinish, setConfirmFinish] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);

    const auth = JSON.parse(localStorage.getItem("auth") || "{}");
    const token = localStorage.getItem("auth_token");

    const user = auth?.user || auth;

    const id_usuario = Number(
        user?.id_usuario ||
        user?.id ||
        0
    );

    const isAdmin = user?.tipo === "administrador";
    const isLogged = !!token;

    const safeJson = async (res) => {
        const text = await res.text();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    };

    function showToast(message, type = "success") {
        setToast({ message, type });
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => setToast(null), 3000);
    }

    async function carregarCarrinho() {
        try {
            setLoading(true);

            if (isAdmin || !id_usuario) {
                setCart([]);
                return;
            }

            const carrinhoRes = await fetch(apiUrl(`carts?id_usuario=${id_usuario}`));
            const carrinhos = await safeJson(carrinhoRes);

            if (!carrinhos?.length) {
                setCart([]);
                return;
            }

            const carrinho = carrinhos[0];

            const itensRes = await fetch(apiUrl(`cart-items/${carrinho.id_carrinho}`));
            const itens = await safeJson(itensRes);

            if (!itens?.length) {
                setCart([]);
                return;
            }

            const itensFormatados = itens.map((item) => ({
                ...item,
                nome_produto: item.produto?.nome || "Produto",
                nome_cor: item.cor?.nome || "Cor",
                nome_tamanho: item.grade?.nome || "Tamanho",
                img: item.foto_produto
                    ? assetUrl(item.foto_produto)
                    : null,
                preco_unitario: Number(item.preco_unitario || 0)
            }));

            setCart(itensFormatados);

        } catch {
            setCart([]);
            showToast("Erro ao carregar carrinho", "error");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!isLogged) {
            setLoading(false);
            setCart([]);
            return;
        }

        carregarCarrinho();
    }, [id_usuario]);

    function toggleSelect(id) {
        setSelectedItems(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    }

    function selecionarTodos() {
        if (selectedItems.length === cart.length) {
            setSelectedItems([]);
        } else {
            setSelectedItems(cart.map(i => i.id_carrinho_item));
        }
    }

    async function alterarQtd(item, tipo) {
        try {
            const novaQtd =
                tipo === "add"
                    ? item.quantidade + 1
                    : item.quantidade - 1;

            if (novaQtd < 1) return;

            const res = await fetch(apiUrl(`cart-items/${item.id_carrinho_item}`), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quantidade: novaQtd })
            });

            if (!res.ok) {
                showToast("Erro ao atualizar quantidade", "error");
                return;
            }

            setCart(prev =>
                prev.map(p =>
                    p.id_carrinho_item === item.id_carrinho_item
                        ? { ...p, quantidade: novaQtd }
                        : p
                )
            );

        } catch {
            showToast("Erro ao atualizar quantidade", "error");
        }
    }

    function removerItem(id) {
        setConfirmDelete(id);
    }

    async function confirmarRemocao() {
        try {
            const res = await fetch(apiUrl(`cart-items/${confirmDelete}`), {
                method: "DELETE"
            });

            if (!res.ok) {
                showToast("Erro ao remover produto", "error");
                return;
            }

            setCart(prev => prev.filter(i => i.id_carrinho_item !== confirmDelete));
            setSelectedItems(prev => prev.filter(i => i !== confirmDelete));

            showToast("Produto removido com sucesso");

        } catch {
            showToast("Erro ao remover produto", "error");
        } finally {
            setConfirmDelete(null);
        }
    }

    async function finalizarCompra() {
        const selecionados = cart.filter(i =>
            selectedItems.includes(i.id_carrinho_item)
        );

        if (!selecionados.length) {
            showToast("Selecione algum item primeiro.", "error");
            return;
        }

        try {
            const enderecoRes = await fetch(apiUrl(`user-addresses/${id_usuario}`));
            const enderecos = await safeJson(enderecoRes);

            if (!Array.isArray(enderecos) || enderecos.length === 0) {
                showToast("Cadastre um endereço primeiro", "error");
                return;
            }

            const endereco = enderecos[0];

            const pedidoRes = await fetch(apiUrl("orders"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_usuario,
                    id_usuario_endereco: endereco.id_usuario_endereco,
                    status: "aguardando_pagamento",
                    valor_total: selecionados.reduce(
                        (acc, item) => acc + item.preco_unitario * item.quantidade,
                        0
                    ),
                    valor_frete: 0
                })
            });

            const pedidoData = await safeJson(pedidoRes);

            const id_pedido = pedidoData?.id_pedido || pedidoData?.id;

            await Promise.all(
                selecionados.map(item =>
                    fetch(apiUrl("order-items"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            id_pedido,
                            id_produto_cor: item.id_produto_cor,
                            id_produto_grade: item.id_produto_grade,
                            quantidade: item.quantidade
                        })
                    })
                )
            );

            await Promise.all(
                selecionados.map(item =>
                    fetch(apiUrl(`cart-items/${item.id_carrinho_item}`), {
                        method: "DELETE"
                    })
                )
            );

            setCart(prev =>
                prev.filter(i => !selectedItems.includes(i.id_carrinho_item))
            );

            setSelectedItems([]);
            showToast("Pedido realizado com sucesso!");

        } catch {
            showToast("Erro ao finalizar compra", "error");
        }
    }

    const subtotal = cart
        .filter(i => selectedItems.includes(i.id_carrinho_item))
        .reduce(
            (acc, item) => acc + item.preco_unitario * item.quantidade,
            0
        );

    if (!isLogged) {
        return (
            <div className="cart-empty">
                <h1>VOCÊ PRECISA ESTAR LOGADO</h1>
                <p>Entre na sua conta para ver seu carrinho.</p>
                <Link to="/login" className="empty-btn">Fazer login</Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="cart-empty">
                <h1>CARREGANDO SEU CARRINHO...</h1>
            </div>
        );
    }

    if (isAdmin) {
        return (
            <div className="cart-empty">
                <h1>ADMINISTRADORES NÃO POSSUEM CARRINHO</h1>
                <Link to="/admin" className="empty-btn">Ir para o painel</Link>
            </div>
        );
    }

    if (cart.length === 0) {
        return (
            <div className="cart-empty">
                <h1>SEU CARRINHO ESTÁ VAZIO</h1>
                <span><ShoppingBag size={60} /></span>
                <Link to="/catalogo" className="empty-btn">Ver Catálogo</Link>
            </div>
        );
    }

    return (
        <div className="cart-page">

            {toast && (
                <div data-cy="carrinho-toast" className={`toast ${toast.type}`}>
                    {toast.message}
                </div>
            )}

            {confirmDelete && (
                <div className="modal-overlay">
                    <div className="modal-confirm">
                        <h3>Remover produto?</h3>

                        <div className="modal-actions">
                            <button
                                data-cy="cancelar-remover"
                                onClick={() => setConfirmDelete(null)}
                            >
                                Cancelar
                            </button>

                            <button
                                data-cy="confirmar-remover"
                                onClick={confirmarRemocao}
                            >
                                Sim, remover
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {confirmFinish && (
                <div className="modal-overlay">
                    <div className="modal-confirm">
                        <h3>Finalizar pedido?</h3>

                        <div className="modal-actions">
                            <button
                                data-cy="cancelar-finalizar"
                                onClick={() => setConfirmFinish(false)}
                            >
                                Cancelar
                            </button>

                            <button
                                data-cy="confirmar-finalizar"
                                onClick={finalizarCompra}
                            >
                                Sim, finalizar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Link to="/catalogo" className="back-link">
                ← Continuar comprando
            </Link>

            <h1>CARRINHO</h1>

            <div className="cart-container">
                <div className="cart-items">
                    <label style={{ marginBottom: 10, display: "block" }}>
                        <input data-cy="selecionar-todos" type="checkbox"
                            checked={cart.length > 0 && selectedItems.length === cart.length}
                            onChange={selecionarTodos} />
                        Selecionar todos
                    </label>

                    {cart.map(item =>

                    (<div className="cart-item"
                        key={item.id_carrinho_item}>

                        <input
                            data-cy={`selecionar-item-${item.id_carrinho_item}`}
                            type="checkbox"
                            checked={selectedItems.includes(item.id_carrinho_item)}
                            onChange={() => toggleSelect(item.id_carrinho_item)}
                            style={{ marginRight: 10 }}
                        />

                        {item.img && (<img src={item.img}

                            alt={item.nome_produto} />)}

                        <div className="cart-info">

                            <h3>{item.nome_produto}</h3>

                            <span>
                                Cor: {item.nome_cor} • Tam: {item.nome_tamanho}
                            </span>

                            <div className="qtd">
                                <button
                                    data-cy={`diminuir-${item.id_carrinho_item}`}
                                    onClick={() => alterarQtd(item, "remove")}> -

                                </button>

                                <span data-cy={`quantidade-${item.id_carrinho_item}`}>
                                    {item.quantidade}
                                </span>

                                <button
                                    data-cy={`aumentar-${item.id_carrinho_item}`}
                                    onClick={() => alterarQtd(item, "add")}>+
                                </button>
                            </div>
                        </div>
                        <div className="cart-price">
                            <span>
                                R$ {(item.preco_unitario * item.quantidade).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                            <Trash2
                                data-cy={`remover-${item.id_carrinho_item}`}
                                onClick={() => removerItem(item.id_carrinho_item)}
                            />
                        </div>
                    </div>))}
                </div>

                <div className="cart-summary">
                    <h2>RESUMO</h2>
                    <div>
                        <span>Subtotal: </span>
                        <span>R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <hr />
                    <div>
                        <strong>TOTAL: </strong>
                        <strong>R$ {subtotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <button
                        data-cy="finalizar-compra"
                        className="finish-btn"
                        onClick={() => setConfirmFinish(true)}
                    >
                        FINALIZAR COMPRA
                    </button>
                </div>
            </div>
        </div>);
}

export default Carrinho;
