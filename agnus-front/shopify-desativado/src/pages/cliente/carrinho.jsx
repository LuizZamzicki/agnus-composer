import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import "../../css/cliente/carrinho.css";
import { EsqueletoLinhas } from "../../components/esqueleto";
import { encerrarSessao, formatarReal, usuarioDaSessao } from "../../utils/sacola";
import { alterarQuantidade, enderecoDoCheckout, obterSacola, removerDaSacola } from "../../utils/loja";

let toastTimeout;

const QUANTIDADE_MAXIMA = 99;

// Depois de entrar (ou criar a conta), o cliente volta para a sacola, já ligada à conta.
const LOGIN_PARA_FINALIZAR = "/login?redirect=/carrinho";

function Carrinho() {
    const [sacola, setSacola] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [ocupado, setOcupado] = useState(false);
    const [indoAoCheckout, setIndoAoCheckout] = useState(false);

    const navigate = useNavigate();
    const idUsuario = usuarioDaSessao();
    const linhas = sacola?.linhas || [];

    function showToast(message, type = "success") {
        setToast({ message, type });
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => setToast(null), 3000);
    }

    const carregarCarrinho = useCallback(async () => {
        setLoading(true);

        try {
            setSacola(await obterSacola());
        } catch {
            showToast("Não foi possível carregar a sacola. Tente de novo.", "error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        carregarCarrinho();
    }, [carregarCarrinho]);

    // Toda alteração devolve a sacola inteira do Shopify, com preços e totais já recalculados.
    async function alterar(acao, mensagemDeErro) {
        setOcupado(true);

        try {
            setSacola(await acao());
        } catch (erro) {
            if (erro.status === 404) {
                // A sacola foi paga ou expirou enquanto a página estava aberta.
                await carregarCarrinho();
            }

            showToast(erro.status === 422 ? erro.message : mensagemDeErro, "error");
        } finally {
            setOcupado(false);
        }
    }

    function alterarQtd(linha, delta) {
        const quantidade = linha.quantidade + delta;

        if (quantidade < 1 || quantidade > QUANTIDADE_MAXIMA) {
            return;
        }

        alterar(() => alterarQuantidade(linha.id, quantidade), "Erro ao atualizar quantidade");
    }

    function confirmarRemocao() {
        const id = confirmDelete;

        setConfirmDelete(null);
        alterar(() => removerDaSacola(id), "Erro ao remover produto");
    }

    async function finalizar() {
        // Só quem tem conta finaliza; a sacola de visitante segue junto para a conta ao entrar.
        if (!usuarioDaSessao()) {
            navigate(LOGIN_PARA_FINALIZAR);
            return;
        }

        setIndoAoCheckout(true);

        try {
            // O pagamento é no checkout do Shopify; a página sai do site da Agnus aqui.
            window.location.assign(await enderecoDoCheckout());
        } catch (erro) {
            setIndoAoCheckout(false);

            if (erro.status === 401) {
                // Sessão vencida: entra de novo e volta para cá, com a sacola guardada.
                encerrarSessao();
                navigate(LOGIN_PARA_FINALIZAR);
                return;
            }

            showToast(erro.message || "Não foi possível abrir o pagamento. Tente de novo.", "error");
        }
    }

    const temIndisponivel = linhas.some((linha) => !linha.disponivel);

    if (loading) {
        return (
            <div className="cart-empty">
                <EsqueletoLinhas rotulo="Carregando a sua sacola…" />
            </div>
        );
    }

    if (linhas.length === 0) {
        return (
            <div className="cart-empty">
                {toast && (
                    <div data-cy="carrinho-toast" className={`toast ${toast.type}`} role="status">
                        {toast.message}
                    </div>
                )}
                <span className="cart-empty-icon"><ShoppingBag size={44} strokeWidth={1} aria-hidden="true" /></span>
                <h1>Sua sacola está vazia</h1>
                <p>Quando escolher uma peça, ela aparece aqui.</p>
                <Link to="/catalogo" className="empty-btn">Ver a coleção</Link>
                {!idUsuario && (
                    <p className="cart-empty-login">
                        Já escolheu antes? <Link to="/login?redirect=/carrinho">Entre na sua conta</Link>
                    </p>
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
                <div className="cart-items" aria-busy={ocupado}>
                    {linhas.map((linha, indice) => (
                        <div className="cart-item" key={linha.id}>
                            {linha.imagem && <img src={linha.imagem} alt={linha.produto.nome} />}

                            <div className="cart-info">
                                <h3>
                                    <Link to={`/produto/${linha.produto.handle}`}>{linha.produto.nome}</Link>
                                </h3>

                                {linha.opcoes.length > 0 && (
                                    <span>{linha.opcoes.map((o) => `${o.nome}: ${o.valor}`).join(" • ")}</span>
                                )}

                                {!linha.disponivel && (
                                    <span className="cart-esgotado" role="note">Esta opção esgotou</span>
                                )}

                                <div className="qtd">
                                    <button
                                        data-cy={`diminuir-${indice}`}
                                        aria-label="Diminuir quantidade"
                                        disabled={ocupado || linha.quantidade <= 1}
                                        onClick={() => alterarQtd(linha, -1)}
                                    >
                                        <Minus size={14} strokeWidth={1.5} />
                                    </button>

                                    <span data-cy={`quantidade-${indice}`}>
                                        {linha.quantidade}
                                    </span>

                                    <button
                                        data-cy={`aumentar-${indice}`}
                                        aria-label="Aumentar quantidade"
                                        disabled={ocupado || linha.quantidade >= QUANTIDADE_MAXIMA}
                                        onClick={() => alterarQtd(linha, 1)}
                                    >
                                        <Plus size={14} strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>

                            <div className="cart-price">
                                <span>{formatarReal(linha.total)}</span>
                                <button
                                    type="button"
                                    className="cart-remove"
                                    data-cy={`remover-${indice}`}
                                    aria-label={`Remover ${linha.produto.nome}`}
                                    disabled={ocupado}
                                    onClick={() => setConfirmDelete(linha.id)}
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
                        <span>{formatarReal(sacola.subtotal)}</span>
                    </div>
                    <div>
                        <span>Frete</span>
                        <span className="cart-frete">calculado no pagamento</span>
                    </div>
                    <hr />
                    <div>
                        <strong>Total</strong>
                        <strong data-cy="carrinho-total">{formatarReal(sacola.total)}</strong>
                    </div>
                    <button
                        type="button"
                        data-cy="finalizar-compra"
                        className="finish-btn"
                        onClick={finalizar}
                        disabled={ocupado || indoAoCheckout || temIndisponivel}
                    >
                        {indoAoCheckout
                            ? "Abrindo o pagamento…"
                            : idUsuario ? "Finalizar pedido" : "Entrar para finalizar"}
                    </button>
                    {temIndisponivel && (
                        <p className="cart-hint">Tire da sacola as opções esgotadas para continuar.</p>
                    )}
                    <p className="cart-hint" data-cy="aviso-finalizar">
                        {idUsuario
                            ? "O pagamento é feito no ambiente seguro do Shopify."
                            : "Para finalizar, entre na sua conta ou crie uma. Sua sacola fica guardada."}
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Carrinho;
