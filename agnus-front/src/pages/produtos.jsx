import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import "../css/produtos.css";

import { apiUrl, assetUrl } from "../utils/api";
import { fetchJsonPaginado } from "../utils/pagination";
import {
  formatarMoeda,
  normalizarProduto,
  obterInicial,
} from "../utils/produtos";

function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [avaliacoes, setAvaliacoes] = useState({});
  const [loading, setLoading] = useState(true);

  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function carregar() {
      setLoading(true);

      try {
        const [prodRes, catRes] = await Promise.all([
          fetchJsonPaginado("/products/catalog", {
            page: 1,
            limit: 12,
            signal: controller.signal,
          }),
          fetchJsonPaginado("/categories", {
            page: 1,
            limit: 100,
            signal: controller.signal,
          }),
        ]);

        const produtosOk = (prodRes.data || []).map(normalizarProduto);

        setProdutos(produtosOk);

        setCategorias(
          (catRes.data || []).map((c) => ({
            id: c.id_categoria,
            nome: c.nome
          }))
        );

        const avaliacoesTemp = {};

        await Promise.all(
          produtosOk.map(async (p) => {
            try {
              const res = await fetch(apiUrl(`/product-reviews/${p.id}`), {
                signal: controller.signal,
              });

              if (!res.ok) throw new Error();

              const data = await res.json();

              if (!Array.isArray(data) || data.length === 0) {
                avaliacoesTemp[p.id] = { media: 0, total: 0 };
                return;
              }

              const soma = data.reduce(
                (acc, r) => acc + (Number(r.nota) || 0),
                0
              );

              const media10 = soma / data.length;
              const media5 = media10 / 2;

              avaliacoesTemp[p.id] = {
                media: media5,
                total: data.length,
              };
            } catch {
              avaliacoesTemp[p.id] = { media: 0, total: 0 };
            }
          })
        );

        setAvaliacoes(avaliacoesTemp);
      } catch (err) {
        console.error("Erro geral:", err);
      } finally {
        setLoading(false);
      }
    }

    carregar();
    return () => controller.abort();
  }, []);

  function renderStars(media = 0) {
    const full = Math.floor(media);
    const decimal = media - full;

    return (
      <div className="rating">
        {[1, 2, 3, 4, 5].map((i) => {
          let className = "star";

          if (i <= full) className = "star filled";
          else if (i === full + 1 && decimal >= 0.5)
            className = "star half";

          return <Star key={i} size={16} className={className} />;
        })}
      </div>
    );
  }

  const filtrados = useMemo(() => {
    return produtos.filter((p) => {
      return (
        p.nome.toLowerCase().includes(busca.toLowerCase()) &&
        (categoria === "" || String(p.categoriaId) === categoria)
      );
    });
  }, [produtos, busca, categoria]);

  if (loading) {
    return <p className="loading">Carregando produtos...</p>;
  }

  return (
    <main data-cy="produtos-page" className="product-listing">
      <h1>Produtos</h1>

      <div className="filters">
        <input
          data-cy="buscar-produto"
          placeholder="Buscar produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        <select data-cy="filtro-categoria" onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="product-grid">
        {filtrados.map((p) => {
          const avaliacao = avaliacoes[p.id] || {
            media: 0,
            total: 0,
          };

          return (
            <Link key={p.id} to={`/produtos/${p.id}`}>
              <div data-cy="produto-card" className="produto-card">
                {p.fotos?.[0] ? (
                  <img
                    src={
                      assetUrl(p.fotos[0])
                    }
                    alt={p.nome}
                  />
                ) : (
                  <div className="placeholder">
                    {obterInicial(p.nome)}
                  </div>
                )}

                <h3>{p.nome}</h3>
                <p className="price">{formatarMoeda(p.preco)}</p>

                {renderStars(avaliacao.media)}

                <small className="rating-text">
                  {avaliacao.media.toFixed(1)} ({avaliacao.total})
                </small>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

export default Produtos;
