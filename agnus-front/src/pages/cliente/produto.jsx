import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../../css/cliente/produto.css";

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

    const navigate = useNavigate();

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

    const [podeAvaliar, setPodeAvaliar] = useState(false);

    const [fotosAvaliacao, setFotosAvaliacao] = useState([]);
    const [novaAvaliacao, setNovaAvaliacao] = useState({
        nome: "",
        nota: 0,
        comentario: "",
        imagens: []
    });

    const [avaliacoes, setAvaliacoes] = useState([]);
    const [avaliacaoResumo, setAvaliacaoResumo] = useState({
        media: 0,
        total: 0
    });

    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxImages, setLightboxImages] = useState([]);
    const imagensValidas = imagens.filter(Boolean);
    const imgPadrao = imagensValidas[0] || null;

    const corObj = cores.find(c => Number(c.id_produto_cor) === Number(corSelecionada));
    const gradeObj = tamanhos.find(t => Number(t.id_produto_grade) === Number(tamanhoSelecionado));

    const precoFinal =
        Number(produto?.preco_base ?? produto?.preco ?? 0) +
        Number(corObj?.acrescimo || 0) +
        Number(gradeObj?.acrescimo || 0);

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

    const handleNotaChange = (e) => {
        let value = e.target.value;

        value = value.replace(",", ".");

        let nota = Number(value);

        if (isNaN(nota)) nota = 0;
        if (nota < 0) nota = 0;
        if (nota > 5) nota = 5;

        setNovaAvaliacao({
            ...novaAvaliacao,
            nota: nota
        });
    };

    const handleFotosChange = (e) => {
        const files = Array.from(e.target.files || []);

        setFotosAvaliacao((prev) => {
            const novas = [...prev, ...files];
            return novas.slice(0, 4);
        });
    };

    useEffect(() => {
        const verificarPedido = async () => {
            try {
                const resPedidos = await fetch(
                    `${BASE_URL}orders?${new URLSearchParams({ id_usuario })}`
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
                            `${BASE_URL}order-items/${pedido.id_pedido}`
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
    }, [id_produto]);

    const enviarAvaliacao = async () => {
        if (!novaAvaliacao.nota) {
            setAlerta({ tipo: "erro", mensagem: "Selecione uma nota" });
            return;
        }

        if (!novaAvaliacao.comentario.trim()) {
            setAlerta({ tipo: "erro", mensagem: "Digite um comentário" });
            return;
        }

        if (!id_produto || !id_usuario) {
            setAlerta({ tipo: "erro", mensagem: "Produto ou usuário não encontrados." });
            return;
        }

        const nomeFinal =
            novaAvaliacao.nome?.trim() ||
            auth?.user?.nome ||
            auth?.nome ||
            "Usuário";

        const payload = {
            id_produto,
            id_usuario,
            nota: Number(novaAvaliacao.nota),
            nome: nomeFinal,
            comentario: novaAvaliacao.comentario.trim()
        };

        try {
            const res = await fetch(`${BASE_URL}product-reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || "Erro ao enviar avaliação");
            }

            const id_avaliacao_produto =
                data.id_avaliacao_produto ||
                data.id ||
                data.data?.id_avaliacao_produto;

            if (fotosAvaliacao.length > 0 && id_avaliacao_produto) {
                const formData = new FormData();
                formData.append("id_avaliacao_produto", id_avaliacao_produto);

                fotosAvaliacao.forEach((file) => {
                    formData.append("files", file);
                });

                await fetch(`${BASE_URL}product-review-photos`, {
                    method: "POST",
                    body: formData
                });
            }

            setAlerta({ tipo: "sucesso", mensagem: "Avaliação enviada!" });

            setMostrarForm(false);
            setNovaAvaliacao({ nota: 0, nome: "", comentario: "", imagens: [] });
            setFotosAvaliacao([]);

            const updated = await fetch(`${BASE_URL}product-reviews/${id_produto}`);
            const lista = await updated.json();

            setAvaliacoes(Array.isArray(lista) ? lista : lista?.data || []);

        } catch (err) {
            setAlerta({ tipo: "erro", mensagem: "Erro ao enviar avaliação: " + err.message });
        }
    };

    const adicionarCarrinho = async () => {
        if (isAdmin) {
            setAlerta({ tipo: "erro", mensagem: "Administradores não podem comprar" });
            return;
        }

        if (!id_usuario) {
            setAlerta({ tipo: "erro", mensagem: "Faça login para continuar" });

            setTimeout(() => {
                navigate(`/login?redirect=/produto/${id_produto}`);
            }, 1500);

            return;
        }

        if (!tamanhoSelecionado || !corSelecionada) {
            setAlerta({ tipo: "erro", mensagem: "Selecione tamanho e cor!" });
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}carts?id_usuario=${id_usuario}`);
            const carrinhos = await res.json();

            let carrinho;

            if (!Array.isArray(carrinhos) || carrinhos.length === 0) {
                const novo = await fetch(`${BASE_URL}carts`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id_usuario })
                });

                carrinho = await novo.json();
            } else {
                carrinho = carrinhos[0];
            }

            const idCarrinho =
                carrinho?.id_carrinho ||
                carrinho?.id ||
                carrinho?.dataValues?.id_carrinho;

            if (!idCarrinho) {
                setAlerta({ tipo: "erro", mensagem: "Erro ao obter carrinho" });
                return;
            }

            const itensRes = await fetch(`${BASE_URL}cart-items/${idCarrinho}`);
            const itens = await itensRes.json();

            const listaItens = Array.isArray(itens) ? itens : itens?.data || [];

            const existente = listaItens.find(i =>
                Number(i.id_produto_cor) === Number(corSelecionada) &&
                Number(i.id_produto_grade) === Number(tamanhoSelecionado)
            );

            if (existente) {
                const novaQtd = Number(existente.quantidade) + 1;

                const updateRes = await fetch(`${BASE_URL}cart-items/${existente.id_carrinho_item}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        quantidade: novaQtd
                    })
                });

                if (!updateRes.ok) {
                    setAlerta({ tipo: "erro", mensagem: "Erro ao atualizar item no carrinho" });
                    return;
                }

                setAlerta({ tipo: "sucesso", mensagem: "Quantidade atualizada no carrinho!" });
                return;
            }

            const response = await fetch(`${BASE_URL}cart-items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id_carrinho: Number(idCarrinho),
                    id_produto_cor: Number(corSelecionada),
                    id_produto_grade: Number(tamanhoSelecionado),
                    quantidade: 1,
                    preco_unitario: precoFinal
                })
            });

            const data = await response.json();

            if (!response.ok) {
                setAlerta({ tipo: "erro", mensagem: data.message || "Erro ao adicionar item" });
                return;
            }

            setAlerta({ tipo: "sucesso", mensagem: "Produto adicionado ao carrinho!" });

        } catch (err) {
            console.error(err);
            setAlerta({ tipo: "erro", mensagem: "Erro ao adicionar ao carrinho" });
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
                setCores(Array.isArray(dataCores) ? dataCores : dataCores.data || []);

                const resGrades = await fetch(`${BASE_URL}product-grades/${id_produto}`);
                const dataGrades = await resGrades.json();
                setTamanhos(Array.isArray(dataGrades) ? dataGrades : dataGrades.data || []);

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

                    <div className="produto-opcao">
                        <span>TAMANHO</span>

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
                                        onClick={() =>
                                            setTamanhoSelecionado(Number(t.id_produto_grade))
                                        }
                                    >
                                        {t.nome}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="produto-opcao">
                        <span>COR</span>

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
                                        onClick={() =>
                                            setCorSelecionada(Number(c.id_produto_cor))
                                        }
                                    >
                                        {c.nome}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <button
                        data-cy="adicionar-carrinho"
                        className="btn-comprar"
                        onClick={adicionarCarrinho}
                        disabled={cores.length === 0 || tamanhos.length === 0}
                    >
                        {cores.length === 0 || tamanhos.length === 0
                            ? "PRODUTO INDISPONÍVEL"
                            : isAdmin
                                ? "INDISPONÍVEL PARA ADMIN"
                                : "ADICIONAR AO CARRINHO"}
                    </button>

                </div>
            </div>

            <div className="avaliacoes-section">

                <div className="avaliacoes-header">

                    <div className="resumo">
                        <h2>AVALIAÇÕES</h2>

                        {avaliacaoResumo.total > 0 && (
                            <>
                                {renderStars(avaliacaoResumo.media)}
                                <small>
                                    {avaliacaoResumo.media.toFixed(1)} de 5 — {avaliacaoResumo.total} avaliações
                                </small>
                            </>
                        )}
                    </div>

                    {podeAvaliar && (
                        <button data-cy="escrever-avaliacao" onClick={() => setMostrarForm(!mostrarForm)}>
                            {mostrarForm ? "Cancelar" : "Escrever avaliação"}
                        </button>
                    )}
                </div>

                {mostrarForm && (
                    <div className="avaliacao-form">

                        <span>Nome</span>
                        <input
                            data-cy="nome-avaliacao"
                            placeholder="Digite seu Nome (Opcional)"
                            value={novaAvaliacao.titulo}
                            onChange={(e) =>
                                setNovaAvaliacao({ ...novaAvaliacao, titulo: e.target.value })
                            }
                        />

                        <span>Nota</span>
                        {renderStars(novaAvaliacao.nota, true, (n) =>
                            setNovaAvaliacao({ ...novaAvaliacao, nota: n })
                        )}

                        <input
                            data-cy="nota-avaliacao"
                            className="notaValue"
                            type="number"
                            step="0.5"
                            min="0"
                            max="5"
                            value={novaAvaliacao.nota}
                            onChange={handleNotaChange}
                        />

                        <textarea
                            data-cy="comentario-avaliacao"
                            placeholder="Comentário"
                            value={novaAvaliacao.comentario}
                            onChange={(e) =>
                                setNovaAvaliacao({ ...novaAvaliacao, comentario: e.target.value })
                            }
                        />

                        <div className="avaliacao-imagens">
                            <span>Fotos (máx 4)</span>

                            <input
                                data-cy="foto-avaliacao"
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFotosChange}
                                disabled={fotosAvaliacao.length >= 4}
                            />

                            {fotosAvaliacao.length > 0 && (
                                <div className="preview-imagens">
                                    {fotosAvaliacao.map((img, index) => (
                                        <img
                                            key={index}
                                            src={URL.createObjectURL(img)}
                                            alt={`Imagem ${index + 1}`}
                                        />
                                    ))}
                                </div>
                            )}

                            {fotosAvaliacao.length >= 4 && (
                                <small>Você pode adicionar até 4 imagens.</small>
                            )}
                        </div>

                        <button data-cy="enviar-avaliacao" onClick={enviarAvaliacao}>
                            Enviar avaliação
                        </button>
                    </div>
                )}

                {avaliacoes.length === 0 ? (
                    <div className="sem-avaliacoes">
                        Ainda não há avaliações para este produto.
                        <br />
                        Realize seu pedido e seja o primeiro a avaliar!
                    </div>
                ) : (
                    avaliacoes.map((a, i) => (
                        <div key={i} className="avaliacao-card">
                            <div className="avaliacao-top">
                                <div className="avaliacao-usuario">
                                    <strong>{a.titulo?.trim() || "Usuário Anônimo"}</strong>
                                    <span>Comentário: <br /></span>
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
                <h2>Produtos relacionados</h2>

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
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxOpen(false);
                        }}
                    >
                        ✕
                    </button>

                    <button
                        className="lightbox-prev"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex((prev) =>
                                prev === 0 ? lightboxImages.length - 1 : prev - 1
                            );
                        }}
                    >
                        ‹
                    </button>

                    <img
                        src={lightboxImages[lightboxIndex]}
                        className="lightbox-img"
                        alt=""
                        onClick={(e) => e.stopPropagation()}
                    />

                    <button
                        className="lightbox-next"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex((prev) =>
                                prev === lightboxImages.length - 1 ? 0 : prev + 1
                            );
                        }}
                    >
                        ›
                    </button>
                </div>
            )}

        </div >

    );
}

export default Produto;
