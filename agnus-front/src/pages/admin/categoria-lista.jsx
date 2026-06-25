import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useNotification } from "../../components/notification";
import { fetchJsonPaginado } from "../../utils/pagination";
import { apiFetch, getAuthHeaders } from "./admin-api";

const PAGINACAO_INICIAL = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

function normalizarCategoria(item, index = 0) {
  return {
    id: item?.id ?? item?.id_categoria ?? item?.categoria_id ?? `categoria-${index}`,
    nome: item?.nome ?? item?.categoria ?? item?.categoria_nome ?? "-",
  };
}

function AdminCategoriaLista() {
  const notify = useNotification();
  const [categoriasLoading, setCategoriasLoading] = useState(false);
  const [categoriasError, setCategoriasError] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState(PAGINACAO_INICIAL);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroBusca]);

  useEffect(() => {
    let ativo = true;

    async function carregarCategorias() {
      setCategoriasError("");
      setCategoriasLoading(true);

      try {
        const { response, payload, data, pagination: meta, request } = await fetchJsonPaginado("/categories", {
          page: currentPage,
          limit,
          headers: getAuthHeaders(),
          fetcher: apiFetch,
        });

        if (!response.ok) {
          if (ativo) setCategoriasError(payload?.message || "Erro ao carregar categorias.");
          return;
        }

        if (ativo) {
          setCategorias(data.map((item, index) => normalizarCategoria(item, index)));
          setPagination(meta);
          if (request.page !== currentPage) {
            setCurrentPage(request.page);
          }
          if (request.limit !== limit) {
            setLimit(request.limit);
          }
        }
      } catch {
        if (ativo) setCategoriasError("Erro ao conectar no servidor.");
      } finally {
        if (ativo) setCategoriasLoading(false);
      }
    }

    carregarCategorias();
    return () => {
      ativo = false;
    };
  }, [currentPage, limit]);

  const categoriasFiltradas = useMemo(() => {
    const busca = filtroBusca.trim().toLowerCase();
    if (!busca) return categorias;

    return categorias.filter((categoria) => {
      return (
        categoria.nome.toLowerCase().includes(busca) || String(categoria.id).toLowerCase().includes(busca)
      );
    });
  }, [categorias, filtroBusca]);

  function fecharModalCategoria() {
    setIsCategoriaModalOpen(false);
    setNovaCategoriaNome("");
    setSalvandoCategoria(false);
  }

  async function cadastrarCategoria() {
    const nome = novaCategoriaNome.trim();
    if (!nome) {
      notify.warning("Digite o nome da categoria.");
      return;
    }

    setSalvandoCategoria(true);
    try {
      const response = await apiFetch("/categories", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ nome }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(data?.message || "Erro ao cadastrar categoria.");
        setSalvandoCategoria(false);
        return;
      }

      notify.success("Categoria cadastrada com sucesso!");
      fecharModalCategoria();
      setCurrentPage(1);
      setCategoriasLoading(true);

      const recarga = await fetchJsonPaginado("/categories", {
        page: 1,
        limit,
        headers: getAuthHeaders(),
        fetcher: apiFetch,
      });

      if (recarga.response.ok) {
        setCategorias(recarga.data.map((item, index) => normalizarCategoria(item, index)));
        setPagination(recarga.pagination);
        if (recarga.request.limit !== limit) {
          setLimit(recarga.request.limit);
        }
      }
    } catch {
      notify.error("Erro ao conectar no servidor.");
      setSalvandoCategoria(false);
    } finally {
      setCategoriasLoading(false);
    }
  }

  return (
    <div className="admin-products-list">
      {isCategoriaModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2>Nova Categoria</h2>
            <div className="admin-form-group">
              <label className="admin-form-label">Nome da Categoria</label>
              <input
                data-cy="input-nome-categoria"
                type="text"
                className="admin-form-input"
                placeholder="Ex.: Vestidos"
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    cadastrarCategoria();
                  }
                }}
              />
            </div>
            <div className="admin-form-actions">
              <button className="admin-form-btn-secondary" onClick={fecharModalCategoria}>
                Cancelar
              </button>
              <button
                data-cy="btn-salvar-categoria"
                className="admin-form-btn-primary"
                onClick={cadastrarCategoria}
                disabled={salvandoCategoria}
              >
                {salvandoCategoria ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-categorias-header">
        <div className="admin-list-filters">
          <input
            data-cy="buscar-categoria"
            type="search"
            className="admin-form-input admin-list-filter-input"
            placeholder="Buscar por ID ou nome da categoria"
            value={filtroBusca}
            onChange={(event) => setFiltroBusca(event.target.value)}
          />
          <select
            className="admin-form-input admin-list-filter-select"
            value={limit}
            onChange={(event) => { setCurrentPage(1); setLimit(Number(event.target.value) || 10); }}
          >
            <option value={10}>10 por pagina</option>
            <option value={20}>20 por pagina</option>
            <option value={30}>30 por pagina</option>
          </select>
        </div>

        <button data-cy="btn-nova-categoria" className="admin-btn-novo" onClick={() => setIsCategoriaModalOpen(true)}>
          <Plus size={18} />
          Cadastrar categoria
        </button>
      </div>

      {categoriasLoading ? (
        <div className="admin-products-empty">
          <p>Carregando categorias...</p>
        </div>
      ) : categoriasError ? (
        <div className="admin-products-empty">
          <p>{categoriasError}</p>
        </div>
      ) : categorias.length === 0 ? (
        <div className="admin-products-empty">
          <p>Nenhuma categoria cadastrada</p>
        </div>
      ) : categoriasFiltradas.length === 0 ? (
        <div className="admin-products-empty">
          <p>Nenhuma categoria encontrada para os filtros informados.</p>
        </div>
      ) : (
        <>
          <div className="admin-products-table-wrapper">
            <table data-cy="tabela-categorias" className="admin-products-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                </tr>
              </thead>
              <tbody>
                {categoriasFiltradas.map((categoria) => (
                  <tr data-cy="categoria-item" key={categoria.id}>
                    <td>{categoria.id}</td>
                    <td>{categoria.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-list-pagination">
            <div className="admin-list-pagination__meta">
              <div className="admin-form-input admin-list-pagination__status">
                Pagina {pagination.page} de {pagination.totalPages}
              </div>
              <span>{pagination.total} categoria(s) no total</span>
            </div>

            <div className="admin-products-acoes">
              <button
                className="admin-btn-novo"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!pagination.hasPreviousPage}
              >
                Anterior
              </button>
              <button
                className="admin-btn-novo"
                onClick={() => setCurrentPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                disabled={!pagination.hasNextPage}
              >
                Proxima
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminCategoriaLista;
