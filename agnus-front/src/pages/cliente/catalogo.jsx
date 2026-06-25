import { useState, useEffect } from "react";
import "../../css/cliente/catalogo.css";
import { Filter, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { apiUrl, assetUrl } from "../../utils/api";

function Catalogo() {

    const [produtos, setProdutos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [busca, setBusca] = useState("");
    const [categoria, setCategoria] = useState("Todos");
    const [ordem, setOrdem] = useState("relevancia");

    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [avaliacoes, setAvaliacoes] = useState({});

    const navigate = useNavigate();
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
            <div className="stars">
                {[1, 2, 3, 4, 5].map(i => (
                    <Star
                        key={i}
                        size={14}
                        fill={i <= Math.round(nota) ? "#facc15" : "#e5e5e5"}
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
            <section className="catalog-hero">
                <span>EXPLORE</span>
                <h1>CATÁLOGO</h1>
                <p>Encontre a peça perfeita que une fé e performance</p>
            </section>

            <div className="catalog-container">

                <aside className="catalog-sidebar">
                    <span><Filter size={22} /> FILTROS</span>

                    <input
                        type="text"
                        data-cy="buscar-produto"
                        placeholder="Buscar produto..."
                        value={busca}
                        onChange={(e) => {
                            setBusca(e.target.value);
                            setPagina(1);
                        }}
                    />

                    <div className="filter-group">
                        <span>CATEGORIA</span>
                        <ul>
                            <li
                                className={categoria === "Todos" ? "active" : ""}
                                onClick={() => {
                                    setCategoria("Todos");
                                    setPagina(1);
                                }}
                            >
                                Todos
                            </li>

                            {categorias.map(cat => (
                                <li
                                    key={cat.id_categoria}
                                    className={Number(categoria) === cat.id_categoria ? "active" : ""}
                                    onClick={() => {
                                        setCategoria(cat.id_categoria);
                                        setPagina(1);
                                    }}
                                >
                                    {cat.nome}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="filter-group">
                        <span>ORDENAR POR</span>
                        <select onChange={(e) => setOrdem(e.target.value)} data-cy="ordenar">
                            <option value="relevancia">Relevância</option>
                            <option value="menor">Menor preço</option>
                            <option value="maior">Maior preço</option>
                        </select>
                    </div>

                </aside>

                <section className="catalog-products">

                    <p className="catalog-count">
                        Página {pagina} de {totalPaginas}
                    </p>

                    <div className="catalog-grid">

                        {produtosOrdenados.map(prod => {

                            const imgPadrao = prod.imagens?.[0];
                            const imgHover = prod.imagens?.[1] || imgPadrao;

                            return (
                                <div
                                    data-cy={`produto-card-${prod.id_produto}`}
                                    className="product-card"
                                    key={prod.id_produto}
                                    onClick={() => navigate(`/produto/${prod.id_produto}`)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <div className="product-image">
                                        <img
                                            src={imgPadrao}
                                            className="img-default"
                                            onError={(e) => (e.target.src = imgPadrao)}
                                        />

                                        <img
                                            src={imgHover}
                                            className="img-hover"
                                            onError={(e) => (e.target.src = imgHover)}
                                        />
                                    </div>

                                    <div className="product-info">
                                        <h3>{prod.nome}</h3>

                                        {renderStars(avaliacoes[prod.id_produto])}

                                        <span>
                                            R$ {Number(prod.preco_base || 0).toLocaleString("pt-BR", {
                                                minimumFractionDigits: 2
                                            })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                    </div>

                    <div className="pagination">
                        <button
                            disabled={pagina === 1}
                            onClick={() => setPagina(pagina - 1)}
                        >
                            ←
                        </button>

                        <span>{pagina} / {totalPaginas}</span>

                        <button
                            disabled={pagina === totalPaginas}
                            onClick={() => setPagina(pagina + 1)}
                        >
                            →
                        </button>
                    </div>

                </section>

            </div>
        </div>
    );
}

export default Catalogo;
