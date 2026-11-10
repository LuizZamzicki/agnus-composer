import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import "../../css/cliente/produto.css";
import AvaliacaoForm from "../../components/avaliacaoForm";
import { authHeaders } from "../../utils/api";
import { SessaoExpirada, adicionarItem, adicionarVisitante, avisarSacola, formatarReal, usuarioDaSessao } from "../../utils/sacola";

function Produto() {
    const { id_produto } = useParams();
    const BASE_URL = process.env.REACT_APP_API_BASE_URL;

    const auth = JSON.parse(localStorage.getItem("auth") || "{}");

    const id_usuario = Number(
        auth?.user?.id_usuario ||
        auth?.user?.id ||
        auth?.id_usuario ||
        auth?.id ||
        0
    );

    const [mostrarForm, setMostrarForm] = useState(false);

    const isAdmin =
        auth?.user?.tipo === "administrador" ||
        auth?.tipo === "administrador";

    const [produto, setProduto] = useState(null);
    const [imagens, setImagens] = useState([]);
    const [cores, setCores] = useState([]);
    const [tamanhos, setTamanhos] = useState([]);
    const [relacionados, setRelacionados] = useState([]);
    const [tamanhoSelecionado, setTamanhoSelecionado] = useState(null);
    const [corSelecionada, setCorSelecionada] = useState(null);
    const [loading, setLoading] = useState(true);
    const [alerta, setAlerta] = useState(null);
    const [faltaEscolher, setFaltaEscolher] = useState(null);
    const [erroCompra, setErroCompra] = useState("");
    const [adicionando, setAdicionando] = useState(false);
    const [adicionado, setAdicionado] = useState(false);
    const botaoSacola = useRef(null);

    const [podeAvaliar, setPodeAvaliar] = useState(false);

    const [avaliacoes, setAvaliacoes] = useState([]);
    const [versaoAvaliacoes, setVersaoAvaliacoes] = useState(0);
    const [avaliacaoResumo, setAvaliacaoResumo] = useState({
        media: 0,
        total: 0
    });

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxImages, setLightboxImages] = useState([]);
    const minhaAvaliacao = avaliacoes.find(a => id_usuario && Number(a.id_usuario) === Number(id_usuario)) || null;
    const imagensValidas = imagens.filter(Boolean);
    const imgPadrao = imagensValidas[0] || null;

    const corObj = cores.find(c => Number(c.id_produto_cor) === Number(corSelecionada));
    const gradeObj = tamanhos.find(t => Number(t.id_produto_grade) === Number(tamanhoSelecionado));

    const precoFinal =
        Number(produto?.preco_base ?? produto?.preco ?? 0) +
        Number(corObj?.acrescimo || 0) +
        Number(gradeObj?.acrescimo || 0);

    useEffect(() => {
        if (!adicionado) return undefined;

        botaoSacola.current?.focus();

        const fecharEsc = (e) => {
            if (e.key === "Escape") setAdicionado(false);
        };

        document.addEventListener("keydown", fecharEsc);
        return () => document.removeEventListener("keydown", fecharEsc);
    }, [adicionado]);

    useEffect(() => {
        if (alerta) {
            const timer = setTimeout(() => setAlerta(null), 1700);
            return () => clearTimeout(timer);
        }
    }, [alerta]);

    const abrirLightbox = (imagens, index) => {
        setLightboxImages(imagens);
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    useEffect(() => {
        if (tamanhos.length === 1) {
            setTamanhoSelecionado(Number(tamanhos[0].id_produto_grade));
        }

        if (cores.length === 1) {
            setCorSelecionada(Number(cores[0].id_produto_cor));
        }
    }, [tamanhos, cores]);

    function renderStars(media = 0, clickable = false, onClick = null) {
        const valor = Number(media) || 0;

        return (
            <div className="rating">
                {[1, 2, 3, 4, 5].map((i) => {
                    let className = "star";

                    if (i <= Math.floor(valor)) {
                        className = "star filled";
                    } else if (i === Math.floor(valor) + 1 && valor % 1 !== 0) {
                        className = "star half";
                    }

                    return (
                        <Star
                            key={i}
                            size={18}
                            className={className}
                            onClick={() => clickable && onClick?.(i)}
                            style={{ cursor: clickable ? "pointer" : "default" }}
                        />
                    );
                })}
            </div>
        );
    }

    useEffect(() => {
        const verificarPedido = async () => {
            try {
                const resPedidos = await fetch(
                    `${BASE_URL}orders/me?status=entregue`,
                    { headers: authHeaders() }
                );

                if (!resPedidos.ok) {
                    throw new Error("Erro ao buscar pedidos");
                }

                const pedidos = await resPedidos.json();

                const pedidosEntregues = pedidos.filter(p => p.status === "entregue");

                if (pedidosEntregues.length === 0) {
                    setPodeAvaliar(false);
                    return;
                }

                const itensPedidos = await Promise.all(
                    pedidosEntregues.map(async (pedido) => {
                        const resItens = await fetch(
                            `${BASE_URL}order-items/${pedido.id_pedido}`,
                            { headers: authHeaders() }
                        );

                        if (!resItens.ok) return [];

                        const itens = await resItens.json();
                        return itens;
                    })
                );

                const todosItens = itensPedidos.flat();

                if (todosItens.length === 0) {
                    setPodeAvaliar(false);
                    return;
                }

                const [resCores, resGrades] = await Promise.all([
                    fetch(`${BASE_URL}product-colors/${id_produto}`),
                    fetch(`${BASE_URL}product-grades/${id_produto}`)
                ]);

                const cores = await resCores.json();
                const grades = await resGrades.json();

                const listaCores = Array.isArray(cores) ? cores : cores?.data || [];
                const listaGrades = Array.isArray(grades) ? grades : grades?.data || [];

                const idsCoresProduto = listaCores.map(c => Number(c.id_produto_cor));
                const idsGradesProduto = listaGrades.map(g => Number(g.id_produto_grade));

                const encontrou = todosItens.some(item =>
                    idsCoresProduto.includes(Number(item.id_produto_cor)) &&
                    idsGradesProduto.includes(Number(item.id_produto_grade))
                );

                setPodeAvaliar(encontrou);

            } catch (err) {
                console.error("Erro ao verificar pedido:", err);
                setPodeAvaliar(false);
            }
        };

        if (id_usuario && id_produto) {
            verificarPedido();
        }
    }, [id_usuario, id_produto]);

    useEffect(() => {
        async function carregarAvaliacoes() {
            try {
                const res = await fetch(`${BASE_URL}product-reviews/${id_produto}`);
                const data = await res.json();

                const lista = Array.isArray(data) ? data : data?.data || [];

                const avaliacoesComFotos = await Promise.all(
                    lista.map(async (av) => {
                        try {
                            const resFotos = await fetch(
                                `${BASE_URL}product-review-photos/${av.id_avaliacao_produto}`
                            );

                            const fotosData = await resFotos.json();

                            const fotos = Array.isArray(fotosData)
                                ? fotosData
                                : fotosData?.data || [];

                            const imagensValidas = fotos
                                .map(f => f.caminho_url)
                                .filter(url => url && url.trim() !== "")
                                .map(url => `${BASE_URL}${url}`);

                            return {
                                ...av,
                                imagens: imagensValidas
                            };
                        } catch {
                            return { ...av, imagens: [] };
                        }
                    })
                );

                setAvaliacoes(avaliacoesComFotos);

                if (avaliacoesComFotos.length === 0) {
                    setAvaliacaoResumo({ media: 0, total: 0 });
                    return;
                }

                const soma = avaliacoesComFotos.reduce(
                    (acc, r) => acc + Number(r.nota || 0),
                    0
                );

                setAvaliacaoResumo({
                    media: soma / avaliacoesComFotos.length,
                    total: avaliacoesComFotos.length
                });

            } catch (err) {
                console.error(err);
            }
        }

        if (id_produto) carregarAvaliacoes();
    }, [id_produto, versaoAvaliacoes]);

    const adicionarCarrinho = async () => {
        setErroCompra("");

        if (isAdmin) {
            setErroCompra("Contas de administrador não fazem compras.");
            return;
        }

        if (!tamanhoSelecionado || !corSelecionada) {
            setFaltaEscolher(!tamanhoSelecionado ? "tamanho" : "cor");
            return;
        }

        const item = {
            id_produto: produto.id_produto,
            id_produto_cor: Number(corSelecionada),
            id_produto_grade: Number(tamanhoSelecionado),
            quantidade: 1,
            preco_unitario: precoFinal,
            nome_produto: produto.nome,
            nome_cor: corObj?.nome,
            nome_tamanho: gradeObj?.nome,
            img: imgPadrao
        };

        setAdicionando(true);

        try {
            const idSessao = usuarioDaSessao();

            if (idSessao) {
                await adicionarItem(idSessao, item);
                avisarSacola();
            } else {
                adicionarVisitante(item);
            }

            setAdicionado(true);
        } catch (err) {
            // Sessão vencida não pode custar a venda: a peça fica guardada até o cliente entrar.
            if (err instanceof SessaoExpirada) {
                adicionarVisitante(item);
                setAdicionado(true);
            } else {
                console.error(err);
                setErroCompra("Não foi possível adicionar a peça. Tente de novo.");
            }
        } finally {
            setAdicionando(false);
        }
    };

    useEffect(() => {
        async function carregarRelacionados() {
            try {
                const res = await fetch(`${BASE_URL}products/catalog`);
                const data = await res.json();

                const lista = data?.data || data || [];
                const nomeBase = produto?.nome?.toLowerCase() || "";

                const filtrados = lista
                    .filter(p =>
                        p.id_produto !== Number(id_produto) &&
                        nomeBase &&
                        p.nome?.toLowerCase().includes(nomeBase.split(" ")[0])
                    )
                    .slice(0, 3);

                const comImagem = await Promise.all(
                    filtrados.map(async (p) => {
                        try {
                            const resFoto = await fetch(`${BASE_URL}product-photos/${p.id_produto}`);
                            const dataFotos = await resFoto.json();

                            const fotos = Array.isArray(dataFotos)
                                ? dataFotos
                                : dataFotos?.data || [];

                            return {
                                ...p,
                                img: fotos.length > 0
                                    ? `${BASE_URL}${fotos[0].caminho_url}`
                                    : null
                            };

                        } catch {
                            return { ...p, img: null };
                        }
                    })
                );

                setRelacionados(comImagem);

            } catch (err) {
                console.error(err);
            }
        }

        if (produto) carregarRelacionados();
    }, [produto]);

    useEffect(() => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }, [id_produto]);

    useEffect(() => {
        async function carregarProduto() {
            try {
                const resProduto = await fetch(`${BASE_URL}products/${id_produto}`);
                const dataProduto = await resProduto.json();
                setProduto(dataProduto);

                const resImagens = await fetch(`${BASE_URL}product-photos/${id_produto}`);
                const dataImagens = await resImagens.json();

                const imgs = Array.isArray(dataImagens)
                    ? dataImagens
                    : dataImagens?.data || [];

                setImagens(imgs.map(img => `${BASE_URL}${img.caminho_url}`));

                const resCores = await fetch(`${BASE_URL}product-colors/${id_produto}`);
                const dataCores = await resCores.json();
                const listaCores = Array.isArray(dataCores) ? dataCores : dataCores.data || [];
                setCores(listaCores);
                setCorSelecionada(listaCores.length === 1 ? Number(listaCores[0].id_produto_cor) : null);

                const resGrades = await fetch(`${BASE_URL}product-grades/${id_produto}`);
                const dataGrades = await resGrades.json();
                const listaTamanhos = Array.isArray(dataGrades) ? dataGrades : dataGrades.data || [];
                setTamanhos(listaTamanhos);
                setTamanhoSelecionado(listaTamanhos.length === 1 ? Number(listaTamanhos[0].id_produto_grade) : null);

            } catch {
                setProduto(null);
            } finally {
                setLoading(false);
            }
        }

        carregarProduto();
    }, [id_produto]);

    if (loading) return <p>Carregando produto...</p>;
    if (!produto) return <p>Produto não encontrado.</p>;

    return (
        <div className="produto-page">

            {alerta && (
                <div data-cy="produto-alerta" className={`alerta ${alerta.tipo}`}>
                    {alerta.mensagem}
                </div>
            )}

            <div className="produto-container">
                <div className="produto-img">

                    <div className="thumbs">
                        {imagensValidas.map((img, index) => (
                            <img
                                key={index}
                                src={img}
                                onClick={() => abrirLightbox(imagensValidas, index)}
                                className={img === lightboxImages[0] ? "active" : ""}
                                alt={produto.nome}
                            />
                        ))}
                    </div>

                    <div className="img-main">
                        {imgPadrao && (
                            <img
                                src={imgPadrao}
                                alt={produto.nome}
                                onClick={() =>
                                    abrirLightbox(
                                        imagensValidas,
                                        imagensValidas.findIndex(i => i === imgPadrao)
                                    )
                                }
                                style={{ cursor: "zoom-in" }}
                            />
                        )}
                    </div>

                </div>

                <div className="produto-info">
                    <h1>{produto.nome}</h1>

                    {avaliacaoResumo.total > 0 ? (
                        <>
                            {renderStars(avaliacaoResumo.media)}
                            <small>
                                {avaliacaoResumo.media.toFixed(1)} de 5.0 — {avaliacaoResumo.total} avaliações
                            </small>
                        </>
                    ) : (
                        <small>Sem avaliações</small>
                    )}

                    <div className="preco-box">
                        <h2>
                            R$ {precoFinal.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2
                            })}
                        </h2>
                    </div>

                    <p>{produto.descricao}</p>

                    <div className={`produto-opcao ${faltaEscolher === "tamanho" ? "falta" : ""}`}>
                        <span>Tamanho</span>

                        <div className="opcoes">
                            {tamanhos.length === 0 ? (
                                <button disabled className="indisponivel">
                                    Indisponível
                                </button>
                            ) : (
                                tamanhos.map(t => (
                                    <button
                                        data-cy={`tamanho-${t.id_produto_grade}`}
                                        key={t.id_produto_grade}
                                        className={
                                            tamanhoSelecionado === t.id_produto_grade
                                                ? "active"
                                                : ""
                                        }
                                        aria-pressed={tamanhoSelecionado === t.id_produto_grade}
                                        onClick={() => {
                                            setTamanhoSelecionado(Number(t.id_produto_grade));
                                            setFaltaEscolher(null);
                                            setAdicionado(false);
                                        }}
                                    >
                                        {t.nome}
                                    </button>
                                ))
                            )}
                        </div>
                        {faltaEscolher === "tamanho" && (
                            <small data-cy="falta-tamanho" className="opcao-aviso" role="alert">Escolha o seu tamanho.</small>
                        )}
                    </div>

                    <div className={`produto-opcao ${faltaEscolher === "cor" ? "falta" : ""}`}>
                        <span>Cor</span>

                        <div className="opcoes">
                            {cores.length === 0 ? (
                                <button disabled className="indisponivel">
                                    Indisponível
                                </button>
                            ) : (
                                cores.map(c => (
                                    <button
                                        data-cy={`cor-${c.id_produto_cor}`}
                                        key={c.id_produto_cor}
                                        className={
                                            corSelecionada === c.id_produto_cor
                                                ? "active"
                                                : ""
                                        }
                                        aria-pressed={corSelecionada === c.id_produto_cor}
                                        onClick={() => {
                                            setCorSelecionada(Number(c.id_produto_cor));
                                            setFaltaEscolher(null);
                                            setAdicionado(false);
                                        }}
                                    >
                                        {c.nome}
                                    </button>
                                ))
                            )}
                        </div>
                        {faltaEscolher === "cor" && (
                            <small data-cy="falta-cor" className="opcao-aviso" role="alert">Escolha a cor.</small>
                        )}
                    </div>

                    <button
                        data-cy="adicionar-carrinho"
                        className="btn-comprar"
                        onClick={adicionarCarrinho}
                        disabled={cores.length === 0 || tamanhos.length === 0 || adicionando}
                    >
                        {cores.length === 0 || tamanhos.length === 0
                            ? "Peça indisponível"
                            : adicionando
                                ? "Adicionando…"
                                : "Adicionar à sacola"}
                    </button>

                    {erroCompra && <p data-cy="erro-compra" className="opcao-aviso" role="alert">{erroCompra}</p>}

                </div>
            </div>

            {adicionado && (
                <div className="sacola-modal-fundo" onClick={() => setAdicionado(false)}>
                    <div
                        data-cy="peca-adicionada"
                        className="sacola-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sacola-modal-titulo"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            data-cy="fechar-peca-adicionada"
                            className="sacola-modal-fechar"
                            aria-label="Fechar"
                            onClick={() => setAdicionado(false)}
                        >
                            <X size={20} strokeWidth={1.5} aria-hidden="true" />
                        </button>

                        <h2 id="sacola-modal-titulo">
                            <Check size={22} strokeWidth={1.5} aria-hidden="true" /> Peça adicionada à sacola
                        </h2>

                        <div className="sacola-modal-peca">
                            {imgPadrao && <img src={imgPadrao} alt="" />}
                            <div>
                                <strong>{produto.nome}</strong>
                                <small>Cor: {corObj?.nome} · Tamanho: {gradeObj?.nome}</small>
                                <span>{formatarReal(precoFinal)}</span>
                            </div>
                        </div>

                        <div className="sacola-modal-acoes">
                            <Link ref={botaoSacola} data-cy="ir-para-sacola" to="/carrinho" className="btn-agnus">Ver sacola e finalizar</Link>
                            <button
                                type="button"
                                data-cy="continuar-escolhendo"
                                className="btn-agnus-ghost"
                                onClick={() => setAdicionado(false)}
                            >
                                Continuar escolhendo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="avaliacoes-section">

                <div className="avaliacoes-header">

                    <div className="resumo">
                        <h2>Avaliações</h2>

                        {avaliacaoResumo.total > 0 && (
                            <>
                                {renderStars(avaliacaoResumo.media)}
                                <small>
                                    {avaliacaoResumo.media.toFixed(1)} de 5 — {avaliacaoResumo.total} avaliações
                                </small>
                            </>
                        )}
                    </div>

                    {(podeAvaliar || minhaAvaliacao) && (
                        <button data-cy="escrever-avaliacao" onClick={() => setMostrarForm(!mostrarForm)}>
                            {mostrarForm ? "Cancelar" : minhaAvaliacao ? "Alterar sua avaliação" : "Escrever avaliação"}
                        </button>
                    )}
                </div>

                {mostrarForm && (
                    <AvaliacaoForm
                        idProduto={id_produto}
                        idUsuario={id_usuario}
                        avaliacao={minhaAvaliacao}
                        onAviso={setAlerta}
                        onConcluir={() => {
                            setMostrarForm(false);
                            setVersaoAvaliacoes((versao) => versao + 1);
                        }}
                    />
                )}

                {avaliacoes.length === 0 ? (
                    <div className="sem-avaliacoes">
                        Ainda não há avaliações para esta peça.
                        <br />
                        Quem receber a sua poderá ser o primeiro a contar como foi.
                    </div>
                ) : (
                    avaliacoes.map((a, i) => (
                        <div key={i} className="avaliacao-card">
                            <div className="avaliacao-top">
                                <div className="avaliacao-usuario">
                                    <strong>{a.titulo?.trim() || "Cliente Agnus"}</strong>
                                </div>

                                {renderStars(a.nota)}
                            </div>

                            <p>{a.comentario}</p>

                            {a.imagens?.length > 0 && (
                                <div className="avaliacao-imagens-lista">
                                    {a.imagens
                                        .filter(img => img && img.trim() !== "")
                                        .map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={img}
                                                alt=""
                                                className="avaliacao-img"
                                                onClick={() => abrirLightbox(a.imagens, idx)}
                                            />
                                        ))}
                                </div>
                            )}
                        </div>
                    ))
                )}

            </div>

            <div className="relacionados">
                <h2>Também da coleção</h2>

                <div className="relacionados-grid">
                    {relacionados.map(p => (
                        <Link
                            to={`/produto/${p.id_produto}`}
                            className="relacionado-card"
                            key={p.id_produto}
                        >
                            {p.img && <img src={p.img} alt={p.nome} />}

                            <h3>{p.nome}</h3>

                            <span>
                                R$ {Number(p.preco_base ?? p.preco ?? 0).toLocaleString("pt-BR", {
                                    minimumFractionDigits: 2
                                })}
                            </span>
                        </Link>
                    ))}
                </div>
            </div>

            {lightboxOpen && (
                <div
                    className="lightbox"
                    onClick={() => setLightboxOpen(false)}
                >
                    <button
                        className="lightbox-close"
                        aria-label="Fechar"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxOpen(false);
                        }}
                    >
                        <X size={26} strokeWidth={1.5} />
                    </button>

                    <button
                        className="lightbox-prev"
                        aria-label="Foto anterior"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex((prev) =>
                                prev === 0 ? lightboxImages.length - 1 : prev - 1
                            );
                        }}
                    >
                        <ChevronLeft size={34} strokeWidth={1.25} />
                    </button>

                    <img
                        src={lightboxImages[lightboxIndex]}
                        className="lightbox-img"
                        alt=""
                        onClick={(e) => e.stopPropagation()}
                    />

                    <button
                        className="lightbox-next"
                        aria-label="Próxima foto"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex((prev) =>
                                prev === lightboxImages.length - 1 ? 0 : prev + 1
                            );
                        }}
                    >
                        <ChevronRight size={34} strokeWidth={1.25} />
                    </button>
                </div>
            )}

        </div >

    );
}

export default Produto;
