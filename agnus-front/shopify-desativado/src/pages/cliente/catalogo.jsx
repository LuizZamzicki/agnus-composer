import { useState, useEffect, useRef } from "react";
import "../../css/cliente/vitrine.css";
import "../../css/cliente/catalogo.css";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { EsqueletoCartoes } from "../../components/esqueleto";
import CartaoProduto from "../../components/cartaoProduto";
import { listarColecoes } from "../../utils/loja";
import { useMediasDeAvaliacao, useVitrine } from "../../utils/useVitrine";

const ESPERA_DA_BUSCA_MS = 250;

function Catalogo() {
    const [colecoes, setColecoes] = useState([]);
    const [busca, setBusca] = useState("");
    const [buscaAplicada, setBuscaAplicada] = useState("");
    const [colecao, setColecao] = useState("");
    const [ordem, setOrdem] = useState("relevancia");
    const location = useLocation();
    const campoBusca = useRef(null);

    // O Shopify busca na loja inteira: com texto digitado, o filtro de coleção não se aplica.
    const colecaoAtiva = buscaAplicada ? "" : colecao;

    const vitrine = useVitrine({ busca: buscaAplicada, colecao: colecaoAtiva, ordem });
    const { produtos, carregando } = vitrine;
    const avaliacoes = useMediasDeAvaliacao(produtos);

    // A lupa do cabeçalho traz o cliente direto para digitar.
    useEffect(() => {
        if (location.state?.focarBusca) campoBusca.current?.focus();
    }, [location.key, location.state]);

    // Espera o cliente parar de digitar antes de consultar.
    useEffect(() => {
        const espera = setTimeout(() => setBuscaAplicada(busca.trim()), ESPERA_DA_BUSCA_MS);
        return () => clearTimeout(espera);
    }, [busca]);

    useEffect(() => {
        listarColecoes()
            .then(setColecoes)
            .catch((err) => console.error("Erro coleções:", err));
    }, []);

    function irPara(mudarPagina) {
        mudarPagina();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

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
                            onChange={(e) => setBusca(e.target.value)}
                        />
                    </label>

                    <div className="filter-group">
                        <h2>Categoria</h2>
                        <ul>
                            <li>
                                <button
                                    type="button"
                                    className={colecaoAtiva === "" ? "active" : ""}
                                    aria-pressed={colecaoAtiva === ""}
                                    onClick={() => {
                                        setColecao("");
                                        setBusca("");
                                    }}
                                >
                                    Todas
                                </button>
                            </li>

                            {colecoes.map(c => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        data-cy={`categoria-${c.handle}`}
                                        className={colecaoAtiva === c.handle ? "active" : ""}
                                        aria-pressed={colecaoAtiva === c.handle}
                                        onClick={() => {
                                            setColecao(c.handle);
                                            setBusca("");
                                        }}
                                    >
                                        {c.nome}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="catalogo-ordem"><h2>Ordenar por</h2></label>
                        <select id="catalogo-ordem" value={ordem} onChange={(e) => setOrdem(e.target.value)} data-cy="ordenar">
                            <option value="relevancia">Relevância</option>
                            <option value="mais-vendidos">Mais pedidas</option>
                            <option value="novidades">Novidades</option>
                            <option value="menor">Menor preço</option>
                            <option value="maior">Maior preço</option>
                        </select>
                    </div>
                </aside>

                <section className="catalog-products" aria-label="Peças">
                    <div
                        className={`catalog-grid${carregando && produtos.length > 0 ? " grade-atualizando" : ""}`}
                        aria-busy={carregando}
                    >
                        {carregando && produtos.length === 0 && <EsqueletoCartoes />}

                        {produtos.map((prod, indice) => (
                            <CartaoProduto
                                key={prod.id}
                                produto={prod}
                                media={avaliacoes[prod.idNumerico]}
                                dataCy={`produto-card-${prod.handle}`}
                                indice={indice}
                            />
                        ))}

                        {!carregando && produtos.length === 0 && (
                            <p className="catalog-empty">
                                {vitrine.erro || `Nenhuma peça encontrada${buscaAplicada ? ` para “${buscaAplicada}”` : ""}.`}
                            </p>
                        )}
                    </div>

                    {(vitrine.temAnterior || vitrine.temProxima) && (
                        <nav className="pagination" aria-label="Paginação">
                            <button
                                disabled={!vitrine.temAnterior || carregando}
                                onClick={() => irPara(vitrine.anterior)}
                                aria-label="Página anterior"
                            >
                                <ChevronLeft size={18} strokeWidth={1.5} />
                            </button>

                            <span>Página {vitrine.pagina}</span>

                            <button
                                disabled={!vitrine.temProxima || carregando}
                                onClick={() => irPara(vitrine.proxima)}
                                aria-label="Próxima página"
                            >
                                <ChevronRight size={18} strokeWidth={1.5} />
                            </button>
                        </nav>
                    )}
                </section>
            </div>
        </div>
    );
}

export default Catalogo;
