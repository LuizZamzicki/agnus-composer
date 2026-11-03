import "../../css/cliente/vitrine.css";
import "../../css/cliente/home.css";
import hero from "../../img/hero.png";
import { Brush, ChevronLeft, ChevronRight, Truck, Shield, Star } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

    const formatarPreco = (valor) =>
        `R$ ${Number(valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

    function renderCard(prod, dataCy) {
        const imgPadrao = prod.imagens[0] || hero;
        const imgHover = prod.imagens[1] || imgPadrao;

        return (
            <Link
                data-cy={dataCy}
                className="product-card"
                key={prod.id_produto}
                to={`/produto/${prod.id_produto}`}
            >
                <div className="product-image">
                    <img
                        src={imgPadrao}
                        alt={prod.nome}
                        className="img-default"
                        loading="lazy"
                        onError={(e) => (e.target.src = hero)}
                    />

                    <img
                        src={imgHover}
                        alt=""
                        aria-hidden="true"
                        className="img-hover"
                        loading="lazy"
                        onError={(e) => (e.target.src = hero)}
                    />
                </div>

                <div className="product-info">
                    <h3>{prod.nome}</h3>
                    {renderStars(avaliacoes[prod.id_produto])}
                    <span className="product-price">{formatarPreco(prod.preco_base)}</span>
                </div>
            </Link>
        );
    }

    return (
        <main data-cy="home-page" className="home">
            <section className="hero">
                <div className="hero-text">
                    <h1>Agnus<br />Dei</h1>
                    <div className="hero-rule" aria-hidden="true" />
                    <p className="hero-lede">Vestir o corpo como quem reza.</p>
                    <blockquote className="hero-verse">
                        <p>“Não sabeis que o vosso corpo é templo do Espírito Santo?”</p>
                        <cite>1 Coríntios 6,19</cite>
                    </blockquote>
                    <div className="hero-buttons">
                        <Link data-cy="ver-colecao" to="/catalogo" className="btn-agnus">
                            Ver a coleção
                        </Link>
                        <a href="#sob-encomenda" className="btn-agnus-ghost">
                            Como fazemos
                        </a>
                    </div>
                </div>

                <div className="hero-arch">
                    <img src={hero} alt="Atleta vestindo regata Agnus com crucifixo bordado, velas acesas ao fundo" />
                </div>
            </section>

            <ul className="benefits" aria-label="Vantagens">
                <li className="benefit"><Truck size={18} strokeWidth={1.5} aria-hidden="true" />Frete grátis acima de R$ 250</li>
                <li className="benefit"><Brush size={18} strokeWidth={1.5} aria-hidden="true" />Estampa exclusiva, feita sob encomenda</li>
                <li className="benefit"><Shield size={18} strokeWidth={1.5} aria-hidden="true" />Pagamento seguro</li>
            </ul>

            {bestSellers.length > 0 && (
                <section className="best-sellers">
                    <h2 className="section-title">Mais pedidos</h2>

                    <div className="catalog-swiper">
                        <Swiper
                            modules={[Autoplay]}
                            spaceBetween={28}
                            slidesPerView={3}
                            loop={bestSellers.length > 3}
                            autoplay={{ delay: 4000, pauseOnMouseEnter: true }}
                            breakpoints={{ 320: { slidesPerView: 1.15 }, 600: { slidesPerView: 2 }, 900: { slidesPerView: 3 } }}
                        >
                            {bestSellers.map(prod => (
                                <SwiperSlide key={prod.id_produto}>
                                    {renderCard(prod, "produto-card-home")}
                                </SwiperSlide>
                            ))}
                        </Swiper>
                    </div>
                </section>
            )}

            <section className="catalog">
                <h2 className="section-title">A coleção</h2>

                <div className="catalog-filters" role="group" aria-label="Filtrar por categoria">
                    <button
                        data-cy="filtro-todos"
                        className={filtro === "todos" ? "active" : ""}
                        aria-pressed={filtro === "todos"}
                        onClick={() => {
                            setFiltro("todos");
                            setPagina(1);
                        }}
                    >
                        Todas
                    </button>

                    {categorias.map(cat => (
                        <button
                            data-cy={`filtro-${cat.id_categoria}`}
                            key={cat.id_categoria}
                            className={Number(filtro) === cat.id_categoria ? "active" : ""}
                            aria-pressed={Number(filtro) === cat.id_categoria}
                            onClick={() => {
                                setFiltro(cat.id_categoria);
                                setPagina(1);
                            }}
                        >
                            {cat.nome}
                        </button>
                    ))}
                </div>

                <div className="catalog-grid-home">
                    {produtos.length > 0 ? (
                        produtos.map(prod => renderCard(prod, "produto-card-home"))
                    ) : (
                        <p className="no-products">Nenhuma peça por aqui ainda.</p>
                    )}
                </div>

                {totalPaginas > 1 && (
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
                )}
            </section>

            <section className="sob-encomenda" id="sob-encomenda">
                <div className="sob-encomenda-inner">
                    <h2>Feita sob encomenda</h2>
                    <p>
                        Nenhuma peça espera na prateleira. A sua começa a ser feita quando você
                        a escolhe: sem estoque parado, sem desperdício, com o cuidado de quem
                        trabalha para a glória de Deus.
                    </p>
                    <p className="sob-encomenda-latin"><em>Ora et labora.</em> Reza e trabalha.</p>
                    <Link className="btn-agnus" to="/catalogo">Escolher a minha peça</Link>
                </div>
            </section>
        </main>
    );
}

export default Home;
