import { useState, useEffect, useRef } from "react";
import "../../css/cliente/vitrine.css";
import "../../css/cliente/catalogo.css";
import { ChevronLeft, ChevronRight, Search, Star } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { apiUrl, assetUrl } from "../../utils/api";

function Catalogo() {

    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [busca, setBusca] = useState("");
    const location = useLocation();
    const campoBusca = useRef(null);

    // A lupa do cabeçalho traz o cliente direto para digitar.
    useEffect(() => {
        if (location.state?.focarBusca) campoBusca.current?.focus();
    }, [location.key, location.state]);
    const [categoria, setCategoria] = useState("Todos");
    const [ordem, setOrdem] = useState("relevancia");

    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [avaliacoes, setAvaliacoes] = useState({});

    async function carregarProdutos(pag = 1) {
        try {

            let url = apiUrl(`products/catalog?page=${pag}&limit=12`);

            if (categoria !== "Todos") {
                url += `&id_categoria=${categoria}`;
            }

            if (busca) {
                url += `&search=${encodeURIComponent(busca)}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            const lista = Array.isArray(data) ? data : data.data || [];

            const produtosTratados = lista.map(prod => ({
                ...prod,
                imagens: (prod.imagens || []).map(assetUrl)
            }));

            setProdutos(produtosTratados);
            setTotalPaginas(data.pagination?.totalPages || 1);

            carregarAvaliacoes(produtosTratados);
        } catch (err) {
            console.error("Erro produtos:", err);
        }
    }

    async function carregarAvaliacoes(produtosLista) {
        try {
            const avaliacoesTemp = {};

            await Promise.all(
                produtosLista.map(async (prod) => {
                    try {
                        const res = await fetch(apiUrl(`product-reviews/${prod.id_produto}`));
                        const data = await res.json();

                        const lista = Array.isArray(data) ? data : data?.data || [];

                        if (lista.length > 0) {
                            const soma = lista.reduce((acc, av) => acc + Number(av.nota || 0), 0);
                            const media = soma / lista.length;

                            avaliacoesTemp[prod.id_produto] = media;
                        }
                    } catch {
                        return null;
                    }
                })
            );

            setAvaliacoes(avaliacoesTemp);

        } catch (err) {
            console.error("Erro avaliações:", err);
        }
    }

    async function carregarCategorias() {
        try {
            const res = await fetch(apiUrl("categories"));
            const data = await res.json();
            setCategorias(data.data || []);
        } catch (err) {
            console.error("Erro categorias:", err);
        }
    }

    function renderStars(media) {
        const nota = Number(media) || 0;

        return (
            <div className="stars" aria-label={nota ? `Nota ${nota.toFixed(1)} de 5` : "Sem avaliações"}>
                {[1, 2, 3, 4, 5].map(i => (
                    <Star
                        key={i}
                        size={13}
                        fill={i <= Math.round(nota) ? "var(--brass)" : "var(--line)"}
                        stroke="none"
                    />
                ))}
            </div>
        );
    }

    useEffect(() => {
        carregarProdutos(pagina);
    }, [pagina, categoria, busca]);

    useEffect(() => {
        carregarCategorias();
    }, []);

    const produtosOrdenados = [...produtos].sort((a, b) => {
        if (ordem === "menor") return a.preco_base - b.preco_base;
        if (ordem === "maior") return b.preco_base - a.preco_base;
        return 0;
    });

    return (
        <div className="catalog-page">
            <header className="catalog-hero">
                <h1>A coleção</h1>
                <p>Peças de treino para quem entende o corpo como templo.</p>
            </header>

            <div className="catalog-container">
                <aside className="catalog-sidebar" aria-label="Filtros">
                    <label className="catalog-search">
                        <Search size={18} strokeWidth={1.5} aria-hidden="true" />
                        <span className="sr-only">Buscar peça</span>
                        <input
                            type="search"
                            ref={campoBusca}
                            data-cy="buscar-produto"
                            placeholder="Buscar produto..."
                            value={busca}
                            onChange={(e) => {
                                setBusca(e.target.value);
                                setPagina(1);
                            }}
                        />
                    </label>

                    <div className="filter-group">
                        <h2>Categoria</h2>
                        <ul>
                            <li>
                                <button
                                    type="button"
                                    className={categoria === "Todos" ? "active" : ""}
                                    aria-pressed={categoria === "Todos"}
                                    onClick={() => {
                                        setCategoria("Todos");
                                        setPagina(1);
                                    }}
                                >
                                    Todas
                                </button>
                            </li>

                            {categorias.map(cat => (
                                <li key={cat.id_categoria}>
                                    <button
                                        type="button"
                                        className={Number(categoria) === cat.id_categoria ? "active" : ""}
                                        aria-pressed={Number(categoria) === cat.id_categoria}
                                        onClick={() => {
                                            setCategoria(cat.id_categoria);
                                            setPagina(1);
                                        }}
                                    >
                                        {cat.nome}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="catalogo-ordem"><h2>Ordenar por</h2></label>
                        <select id="catalogo-ordem" onChange={(e) => setOrdem(e.target.value)} data-cy="ordenar">
                            <option value="relevancia">Relevância</option>
                            <option value="menor">Menor preço</option>
                            <option value="maior">Maior preço</option>
                        </select>
                    </div>
                </aside>

                <section className="catalog-products" aria-label="Peças">
                    <div className="catalog-grid">
                        {produtosOrdenados.map(prod => {
                            const imgPadrao = prod.imagens?.[0];
                            const imgHover = prod.imagens?.[1] || imgPadrao;

                            return (
                                <Link
                                    data-cy={`produto-card-${prod.id_produto}`}
                                    className="product-card"
                                    key={prod.id_produto}
                                    to={`/produto/${prod.id_produto}`}
                                >
                                    <div className="product-image">
                                        {imgPadrao && (
                                            <img src={imgPadrao} alt={prod.nome} className="img-default" loading="lazy" />
                                        )}
                                        {imgHover && (
                                            <img src={imgHover} alt="" aria-hidden="true" className="img-hover" loading="lazy" />
                                        )}
                                    </div>

                                    <div className="product-info">
                                        <h3>{prod.nome}</h3>
                                        {renderStars(avaliacoes[prod.id_produto])}
                                        <span className="product-price">
                                            R$ {Number(prod.preco_base || 0).toLocaleString("pt-BR", {
                                                minimumFractionDigits: 2
                                            })}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}

                        {produtosOrdenados.length === 0 && (
                            <p className="catalog-empty">
                                Nenhuma peça encontrada{busca ? ` para “${busca}”` : ""}.
                            </p>
                        )}
                    </div>

                    <nav className="pagination" aria-label="Paginação">
                        <button
                            disabled={pagina === 1}
                            onClick={() => setPagina(pagina - 1)}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={18} strokeWidth={1.5} />
                        </button>

                        <span>{pagina} / {totalPaginas}</span>

                        <button
                            disabled={pagina === totalPaginas}
                            onClick={() => setPagina(pagina + 1)}
                            aria-label="Próxima página"
                        >
                            <ChevronRight size={18} strokeWidth={1.5} />
                        </button>
                    </nav>
                </section>
            </div>
        </div>
    );
}

export default Catalogo;
