import "../../css/cliente/home.css";
import hero from "../../img/hero.png";
import { Brush, Truck, Shield, Star } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiUrl, assetUrl } from "../../utils/api";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import { Autoplay } from "swiper/modules";

function Home() {
    const [produtos, setProdutos] = useState([]);
    const [bestSellers, setBestSellers] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [filtro, setFiltro] = useState("todos");
    const [pagina, setPagina] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(1);
    const [avaliacoes, setAvaliacoes] = useState({});

    const navigate = useNavigate();
    async function carregarProdutos(pag = 1, filtroAtual = filtro) {
        try {
            let url = apiUrl(`products/catalog?page=${pag}&limit=12`);

            if (filtroAtual !== "todos") {
                url += `&id_categoria=${filtroAtual}`;
            }

            const res = await fetch(url);
            const data = await res.json();

            const lista = Array.isArray(data.data) ? data.data : [];

            const produtosTratados = lista.map(prod => ({
                ...prod,
                imagens: (prod.imagens || []).map(assetUrl),
                categoria_id: prod.id_categoria
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

    async function carregarBestSellers() {
        try {
            const res = await fetch(apiUrl("products/best-sellers?page=1&limit=6"));
            const data = await res.json();

            const lista = Array.isArray(data.data) ? data.data : [];

            const produtosTratados = lista.map(prod => ({
                ...prod,
                imagens: (prod.imagens || []).map(assetUrl)
            }));

            setBestSellers(produtosTratados);

        } catch (err) {
            console.error("Erro best sellers:", err);
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

    useEffect(() => {
        carregarBestSellers();
        carregarCategorias();
    }, []);

    useEffect(() => {
        carregarProdutos(pagina, filtro);
    }, [pagina, filtro]);

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

    return (
        <main data-cy="home-page" className="home">
            <section className="hero" style={{ backgroundImage: `url(${hero})` }}>
                <div className="hero-text">
                    <span className="tag-home">SAÚDE • FÉ • PROPÓSITO</span>
                    <h1>
                        VISTA SUA FÉ.<br />
                        <span>SUPERE SEUS LIMITES.</span>
                    </h1>
                    <p>
                        Roupas fitness com identidade católica. Produção sob demanda,
                        exclusividade e consciência em cada peça.
                    </p>
                    <div className="hero-buttons">
                        <Link data-cy="ver-colecao" to="/catalogo" className="btn-primary">
                            VER COLEÇÃO
                        </Link>
                    </div>
                </div>
            </section>

            <section className="benefits">
                <div className="benefit"><span><Truck size={22} /></span>FRETE GRÁTIS ACIMA DE R$ 250</div>
                <div className="benefit"><span><Brush size={22} /></span>PRINT-ON-DEMAND EXCLUSIVO</div>
                <div className="benefit"><span><Shield size={22} /></span>PAGAMENTO 100% SEGURO</div>
            </section>

            <section className="best-sellers">
                <div className="section-title">
                    <span>DESTAQUES</span>
                    <h2>MAIS VENDIDOS</h2>
                </div>

                <div className="catalog-swiper">
                    <Swiper
                        modules={[Autoplay]}
                        spaceBetween={25}
                        slidesPerView={3}
                        loop={true}
                        autoplay={{ delay: 2500 }}
                        breakpoints={{ 320: { slidesPerView: 1 }, 600: { slidesPerView: 2 }, 900: { slidesPerView: 3 } }}
                    >
                        {bestSellers.map(prod => {
                            const imgPadrao = prod.imagens[0] || hero;
                            const imgHover = prod.imagens[1] || imgPadrao;

                            return (
                                <SwiperSlide key={prod.id_produto}>
                                    <div
                                        data-cy="produto-card-home"
                                        className="product-card"
                                        key={prod.id_produto}
                                        onClick={() => navigate(`/produto/${prod.id_produto}`)}
                                        style={{ cursor: "pointer" }}
                                    >
                                        <div className="product-image">
                                            <img
                                                src={imgPadrao}
                                                className="img-default"
                                                onError={(e) => (e.target.src = hero)}
                                            />

                                            <img
                                                src={imgHover}
                                                className="img-hover"
                                                onError={(e) => (e.target.src = hero)}
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
                                </SwiperSlide>
                            );
                        })}
                    </Swiper>
                </div>
            </section>

            <section className="catalog">
                <div className="section-title">
                    <span>COLEÇÃO COMPLETA</span>
                    <h2>CATÁLOGO</h2>
                </div>

                <div className="catalog-filters">
                    <button
                        data-cy="filtro-todos"
                        className={filtro === "todos" ? "active" : ""}
                        onClick={() => {
                            setFiltro("todos");
                            setPagina(1);
                        }}
                    >
                        TODOS
                    </button>

                    {categorias.map(cat => (
                        <button
                            data-cy={`filtro-${cat.id_categoria}`}
                            key={cat.id_categoria}
                            className={Number(filtro) === cat.id_categoria ? "active" : ""}
                            onClick={() => {
                                setFiltro(cat.id_categoria);
                                setPagina(1);
                            }}
                        >
                            {cat.nome.toUpperCase()}
                        </button>
                    ))}
                </div>

                <div className="catalog-grid-home">
                    {produtos.length > 0 ? (
                        produtos.map(prod => {
                            const imgPadrao = prod.imagens[0] || hero;
                            const imgHover = prod.imagens[1] || imgPadrao;

                            return (
                                <div
                                    className="product-card"
                                    key={prod.id_produto}
                                    onClick={() => navigate(`/produto/${prod.id_produto}`)}
                                    style={{ cursor: "pointer" }}
                                >
                                    <div className="product-image">
                                        <img
                                            src={imgPadrao}
                                            className="img-default"
                                            onError={(e) => (e.target.src = hero)}
                                        />

                                        <img
                                            src={imgHover}
                                            className="img-hover"
                                            onError={(e) => (e.target.src = hero)}
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
                        })
                    ) : (
                        <p className="no-products">Nenhum produto encontrado.</p>
                    )}
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

        </main>
    );
}

export default Home;
