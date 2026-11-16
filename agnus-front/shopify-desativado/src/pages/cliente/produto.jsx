import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import "../../css/cliente/produto.css";
import AvaliacaoForm, { Estrelas } from "../../components/avaliacaoForm";
import { apiUrl } from "../../utils/api";
import { encerrarSessao, formatarReal, usuarioDaSessao } from "../../utils/sacola";
import {
    adicionarNaSacola,
    buscarProduto,
    guardarPecaPendente,
    listarRelacionados,
    retomarPecaPendente,
    varianteEscolhida,
} from "../../utils/loja";
import { EsqueletoProduto } from "../../components/esqueleto";

// "4,5 de 5 · 1 avaliação": vírgula decimal e singular quando há uma só.
function textoResumoAvaliacoes({ media, total }) {
    return `${media.toFixed(1).replace(".", ",")} de 5 · ${total} ${total === 1 ? "avaliação" : "avaliações"}`;
}

// Atributo data-cy estável a partir do nome da opção ("Tamanho" + "GG" -> "opcao-tamanho-gg").
const slug = (texto) =>
    String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

// Opção de valor único já vem escolhida.
function escolhasIniciais(produto) {
    return Object.fromEntries(
        produto.opcoes.filter((opcao) => opcao.valores.length === 1).map((opcao) => [opcao.nome, opcao.valores[0].nome])
    );
}

function Produto() {
    // A rota segue /produto/:id_produto; o valor agora é o handle da peça no Shopify.
    const { id_produto: handle } = useParams();
    const navigate = useNavigate();

    const auth = JSON.parse(localStorage.getItem("auth") || "{}");

    const id_usuario = Number(
        auth?.user?.id_usuario ||
        auth?.user?.id ||
        auth?.id_usuario ||
        auth?.id ||
        0
    );

    const [mostrarForm, setMostrarForm] = useState(false);

    const [produto, setProduto] = useState(null);
    const [escolhas, setEscolhas] = useState({});
    const [relacionados, setRelacionados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [alerta, setAlerta] = useState(null);
    const [faltaEscolher, setFaltaEscolher] = useState(null);
    const [erroCompra, setErroCompra] = useState("");
    const [adicionando, setAdicionando] = useState(false);
    const [adicionado, setAdicionado] = useState(false);
    const botaoSacola = useRef(null);

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

    const opcoes = produto?.opcoes || [];
    const variante = varianteEscolhida(produto, escolhas);
    // O serviço de avaliações guarda a peça pelo id numérico do Shopify.
    const idAvaliacoes = produto?.idNumerico;

    // A foto da variante (ex.: a cor escolhida) vem primeiro na galeria.
    const imagensValidas = [...new Set([variante?.imagem, ...(produto?.imagens || []).map((img) => img.url)].filter(Boolean))];
    const imgPadrao = imagensValidas[0] || null;

    const precoFinal = variante?.preco ?? produto?.preco ?? 0;
    const precoDe = variante ? variante.precoComparado : null;
    const semVariantes = !produto?.variantes?.length;
    const esgotada = Boolean(produto) && !produto.disponivel;
    const resumoEscolhas = opcoes.map((opcao) => `${opcao.nome}: ${escolhas[opcao.nome]}`).join(" · ");

    // Há variante à venda com este valor e as demais escolhas já feitas?
    function valorDisponivel(nomeOpcao, valor) {
        return produto.variantes.some((v) =>
            v.disponivel &&
            v.opcoes[nomeOpcao] === valor &&
            opcoes.every((o) => o.nome === nomeOpcao || !escolhas[o.nome] || v.opcoes[o.nome] === escolhas[o.nome])
        );
    }

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
        async function carregarAvaliacoes() {
            try {
                const res = await fetch(apiUrl(`product-reviews/${idAvaliacoes}`));
                const data = await res.json();

                const lista = Array.isArray(data) ? data : data?.data || [];

                const avaliacoesComFotos = await Promise.all(
                    lista.map(async (av) => {
                        try {
                            const resFotos = await fetch(
                                apiUrl(`product-review-photos/${av.id_avaliacao_produto}`)
                            );

                            const fotosData = await resFotos.json();

                            const fotos = Array.isArray(fotosData)
                                ? fotosData
                                : fotosData?.data || [];

                            const imagens = fotos
                                .map(f => f.caminho_url)
                                .filter(url => url && url.trim() !== "")
                                .map(url => apiUrl(url));

                            return { ...av, imagens };
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

        if (idAvaliacoes) carregarAvaliacoes();
    }, [idAvaliacoes, versaoAvaliacoes]);

    const adicionarCarrinho = async () => {
        setErroCompra("");

        const faltando = opcoes.find((opcao) => !escolhas[opcao.nome]);

        if (faltando) {
            setFaltaEscolher(faltando.nome);
            return;
        }

        if (!variante || !variante.disponivel) {
            setErroCompra("Esta combinação esgotou. Escolha outra opção.");
            return;
        }

        // Sem conta, a escolha fica guardada: depois do login o cliente volta aqui e a peça entra na sacola.
        if (!usuarioDaSessao()) {
            pedirLogin(variante.id);
            return;
        }

        await colocarNaSacola(variante.id);
    };

    function pedirLogin(varianteId) {
        guardarPecaPendente({ handle, varianteId });
        navigate(`/login?redirect=${encodeURIComponent(`/produto/${handle}`)}`);
    }

    async function colocarNaSacola(varianteId) {
        setAdicionando(true);

        try {
            await adicionarNaSacola(varianteId, 1);
            setAdicionado(true);
        } catch (err) {
            if (err.status === 401) {
                // Sessão vencida no meio: entra de novo e a mesma peça entra na sacola na volta.
                encerrarSessao();
                pedirLogin(varianteId);
                return;
            }

            console.error(err);
            setErroCompra(err.message || "Não foi possível adicionar a peça. Tente de novo.");
        } finally {
            setAdicionando(false);
        }
    }

    // O carregamento da peça roda uma vez por handle; a referência dá a ele a versão atual da função.
    const colocarNaSacolaRef = useRef(colocarNaSacola);
    colocarNaSacolaRef.current = colocarNaSacola;

    useEffect(() => {
        if (!produto) return undefined;

        let ativo = true;

        listarRelacionados(produto.handle)
            .then((lista) => {
                if (ativo) setRelacionados(lista);
            })
            .catch((err) => console.error(err));

        return () => {
            ativo = false;
        };
    }, [produto]);

    useEffect(() => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }, [handle]);

    useEffect(() => {
        let ativo = true;

        setLoading(true);
        setAdicionado(false);
        setFaltaEscolher(null);
        setErroCompra("");

        buscarProduto(handle)
            .then((dados) => {
                if (!ativo) return;
                setProduto(dados);

                // Volta do login com uma peça escolhida antes: refaz a escolha e põe na sacola.
                const pendente = usuarioDaSessao() ? retomarPecaPendente(dados.handle) : null;
                const varianteGuardada = pendente && dados.variantes.find((v) => v.id === pendente.varianteId);

                setEscolhas({ ...escolhasIniciais(dados), ...varianteGuardada?.opcoes });

                if (varianteGuardada?.disponivel) {
                    colocarNaSacolaRef.current(varianteGuardada.id);
                } else if (varianteGuardada) {
                    setErroCompra("Esta combinação esgotou enquanto você entrava. Escolha outra opção.");
                }
            })
            .catch(() => {
                if (ativo) setProduto(null);
            })
            .finally(() => {
                if (ativo) setLoading(false);
            });

        return () => {
            ativo = false;
        };
    }, [handle]);

    if (loading) return <EsqueletoProduto />;
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
                            <Estrelas nota={avaliacaoResumo.media} />
                            <small>
                                {textoResumoAvaliacoes(avaliacaoResumo)}
                            </small>
                        </>
                    ) : (
                        <small>Sem avaliações</small>
                    )}

                    <div className="preco-box">
                        <h2 data-cy="produto-preco">
                            {precoDe && (
                                <s className="preco-de">
                                    <span className="sr-only">De </span>{formatarReal(precoDe)}
                                </s>
                            )}
                            {precoDe && <span className="sr-only"> por </span>}
                            {formatarReal(precoFinal)}
                        </h2>
                    </div>

                    <p>{produto.descricao}</p>

                    {opcoes.map((opcao) => (
                        <div key={opcao.nome} className={`produto-opcao ${faltaEscolher === opcao.nome ? "falta" : ""}`}>
                            <span>{opcao.nome}</span>

                            <div className="opcoes">
                                {opcao.valores.map((valor) => {
                                    const ativo = escolhas[opcao.nome] === valor.nome;
                                    const disponivel = valorDisponivel(opcao.nome, valor.nome);

                                    return (
                                        <button
                                            type="button"
                                            data-cy={`opcao-${slug(opcao.nome)}-${slug(valor.nome)}`}
                                            key={valor.nome}
                                            className={`${ativo ? "active" : ""} ${disponivel ? "" : "esgotada"}`.trim()}
                                            aria-pressed={ativo}
                                            aria-label={disponivel ? undefined : `${valor.nome} (esgotada)`}
                                            onClick={() => {
                                                setEscolhas((atuais) => ({ ...atuais, [opcao.nome]: valor.nome }));
                                                setFaltaEscolher(null);
                                                setErroCompra("");
                                                setAdicionado(false);
                                            }}
                                        >
                                            {valor.nome}
                                        </button>
                                    );
                                })}
                            </div>
                            {faltaEscolher === opcao.nome && (
                                <small data-cy={`falta-${slug(opcao.nome)}`} className="opcao-aviso" role="alert">
                                    Escolha {opcao.nome.toLowerCase()}.
                                </small>
                            )}
                        </div>
                    ))}

                    <button
                        data-cy="adicionar-carrinho"
                        className="btn-comprar"
                        onClick={adicionarCarrinho}
                        disabled={semVariantes || esgotada || adicionando}
                    >
                        {semVariantes || esgotada
                            ? "Peça esgotada"
                            : variante && !variante.disponivel
                                ? "Esgotada nesta opção"
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
                                {resumoEscolhas && <small>{resumoEscolhas}</small>}
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
                                <Estrelas nota={avaliacaoResumo.media} />
                                <small>
                                    {textoResumoAvaliacoes(avaliacaoResumo)}
                                </small>
                            </>
                        )}
                    </div>

                    {minhaAvaliacao && (
                        <button data-cy="escrever-avaliacao" onClick={() => setMostrarForm(!mostrarForm)}>
                            {mostrarForm ? "Cancelar" : minhaAvaliacao ? "Alterar sua avaliação" : "Escrever avaliação"}
                        </button>
                    )}
                </div>

                {mostrarForm && (
                    <AvaliacaoForm
                        idProduto={idAvaliacoes}
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

                                <Estrelas nota={a.nota} />
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

            {/* Sem recomendações do Shopify (loja com poucas peças), o título ficaria sozinho. */}
            {relacionados.length > 0 && (
                <div className="relacionados">
                    <h2>Também da coleção</h2>

                    <div className="relacionados-grid">
                        {relacionados.map(p => (
                            <Link
                                to={`/produto/${p.handle}`}
                                className="relacionado-card"
                                key={p.id}
                            >
                                {p.imagens[0] && <img src={p.imagens[0]} alt={p.nome} />}

                                <h3>{p.nome}</h3>

                                <span>{formatarReal(p.preco)}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

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
