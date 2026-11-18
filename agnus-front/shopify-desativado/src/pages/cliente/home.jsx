import "../../css/cliente/vitrine.css";
import "../../css/cliente/home.css";
import hero from "../../img/hero.png";
import { Brush, ChevronLeft, ChevronRight, Truck, Shield } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EsqueletoCartoes } from "../../components/esqueleto";
import CartaoProduto from "../../components/cartaoProduto";
import { listarColecoes, listarProdutos } from "../../utils/loja";
import { useMediasDeAvaliacao, useVitrine } from "../../utils/useVitrine";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

import { Autoplay } from "swiper/modules";

function Home() {
    const [bestSellers, setBestSellers] = useState([]);
    const [colecoes, setColecoes] = useState([]);
    const [filtro, setFiltro] = useState("");

    const vitrine = useVitrine({ colecao: filtro });
    const produtos = vitrine.produtos;
    const carregando = vitrine.carregando;
    const avaliacoes = useMediasDeAvaliacao(produtos);
    const avaliacoesMaisPedidos = useMediasDeAvaliacao(bestSellers);

    useEffect(() => {
        listarProdutos({ ordem: "mais-vendidos", limite: 6 })
            .then((dados) => setBestSellers(dados.produtos))
            .catch((err) => console.error("Erro mais pedidos:", err));

        listarColecoes()
            .then(setColecoes)
            .catch((err) => console.error("Erro coleções:", err));
    }, []);

    function renderCard(prod, dataCy, indice = null, medias = avaliacoes) {
        return (
            <CartaoProduto
                key={prod.id}
                produto={prod}
                media={medias[prod.idNumerico]}
                dataCy={dataCy}
                indice={indice}
                imagemReserva={hero}
            />
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
                                <SwiperSlide key={prod.id}>
                                    {renderCard(prod, "produto-card-home", null, avaliacoesMaisPedidos)}
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
                        className={filtro === "" ? "active" : ""}
                        aria-pressed={filtro === ""}
                        onClick={() => setFiltro("")}
                    >
                        Todas
                    </button>

                    {colecoes.map(colecao => (
                        <button
                            data-cy={`filtro-${colecao.handle}`}
                            key={colecao.id}
                            className={filtro === colecao.handle ? "active" : ""}
                            aria-pressed={filtro === colecao.handle}
                            onClick={() => setFiltro(colecao.handle)}
                        >
                            {colecao.nome}
                        </button>
                    ))}
                </div>

                <div
                    className={`catalog-grid-home${carregando && produtos.length > 0 ? " grade-atualizando" : ""}`}
                    aria-busy={carregando}
                >
                    {carregando && produtos.length === 0 && <EsqueletoCartoes />}
                    {produtos.map((prod, indice) => renderCard(prod, "produto-card-home", indice))}
                    {!carregando && produtos.length === 0 && (
                        <p className="no-products">
                            {vitrine.erro || "Nenhuma peça por aqui ainda."}
                        </p>
                    )}
                </div>

                {(vitrine.temAnterior || vitrine.temProxima) && (
                    <nav className="pagination" aria-label="Paginação">
                        <button
                            disabled={!vitrine.temAnterior || carregando}
                            onClick={vitrine.anterior}
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={18} strokeWidth={1.5} />
                        </button>

                        <span>Página {vitrine.pagina}</span>

                        <button
                            disabled={!vitrine.temProxima || carregando}
                            onClick={vitrine.proxima}
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
