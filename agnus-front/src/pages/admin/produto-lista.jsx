import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Package, Plus, Trash2 } from "lucide-react";
import { useNotification } from "../../components/notification";
import { fetchJsonPaginado } from "../../utils/pagination";
import { apiFetch, formatarMoeda, getAuthHeaders, normalizarProdutoResumo } from "./admin-api";

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

function AdminProdutoLista() {
  const navigate = useNavigate();
  const notify = useNotification();
  const [produtosLoading, setProdutosLoading] = useState(false);
  const [produtosError, setProdutosError] = useState("");
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState(PAGINACAO_INICIAL);

  useEffect(() => {
    setCurrentPage(1);
  }, [filtroBusca, filtroCategoria]);

  useEffect(() => {
    let ativo = true;

    async function carregarProdutos() {
      setProdutosError("");
      setProdutosLoading(true);

      try {
        const headers = getAuthHeaders();
        const { response, payload, data, pagination: meta, request } = await fetchJsonPaginado("/products", {
          page: currentPage,
          limit,
          headers,
          fetcher: apiFetch,
        });

        if (!response.ok) {
          if (ativo) setProdutosError(payload?.message || "Erro ao carregar produtos.");
          return;
        }

        if (ativo) {
          setProdutos(data.map((item) => normalizarProdutoResumo(item)));
          setPagination(meta);
          if (request.page !== currentPage) {
            setCurrentPage(request.page);
          }
          if (request.limit !== limit) {
            setLimit(request.limit);
          }
        }
      } catch {
        if (ativo) setProdutosError("Erro ao conectar no servidor.");
      } finally {
        if (ativo) setProdutosLoading(false);
      }
    }

    carregarProdutos();
    return () => {
      ativo = false;
    };
  }, [currentPage, limit]);

  useEffect(() => {
    let ativo = true;

    async function carregarCategorias() {
      try {
        const headers = getAuthHeaders();
        const { response, data } = await fetchJsonPaginado("/categories", {
          page: 1,
          limit: 100,
          headers,
          fetcher: apiFetch,
        });

        if (!response.ok || !ativo) {
          return;
        }

        setCategorias(data.map((item, index) => normalizarCategoria(item, index)));
      } catch {
        if (ativo) {
          setCategorias([]);
        }
      }
    }

    carregarCategorias();
    return () => {
      ativo = false;
    };
  }, []);

  const categoriasMap = useMemo(() => {
    const map = new Map();
    categorias.forEach((categoria) => {
      map.set(String(categoria.id), categoria.nome);
    });
    return map;
  }, [categorias]);

  const produtosFiltrados = useMemo(() => {
    const busca = filtroBusca.trim().toLowerCase();

    return produtos.filter((produto) => {
      const nomeCategoria = categoriasMap.get(String(produto.categoriaId)) ?? "";
      const bateBusca =
        !busca ||
        produto.nome.toLowerCase().includes(busca) ||
        String(produto.id).includes(busca) ||
        nomeCategoria.toLowerCase().includes(busca);

      const bateCategoria = !filtroCategoria || String(produto.categoriaId) === filtroCategoria;
      return bateBusca && bateCategoria;
    });
  }, [produtos, categoriasMap, filtroBusca, filtroCategoria]);

  function obterNomeCategoria(idCategoria) {
    if (idCategoria === null || idCategoria === undefined) {
      return "-";
    }
    return categoriasMap.get(String(idCategoria)) ?? String(idCategoria);
  }

  function novoProduto() {
    navigate("/admin/produtos/cadastrar");
  }

  function editarProduto(produto) {
    if (!produto?.id) return;
    navigate(`/admin/produtos/editar/${produto.id}`);
  }

  async function deletarProduto(id) {
    const confirmado = await notify.confirm({
      title: "Excluir produto",
      message: "Tem certeza que deseja excluir este produto? Essa acao nao pode ser desfeita.",
      confirmText: "Excluir",
      cancelText: "Cancelar",
      tone: "danger",
    });

    if (!confirmado) {
      return;
    }

    try {
      const response = await apiFetch(`/products/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(data?.message || "Erro ao deletar produto.");
        return;
      }

      const produtosAtualizados = produtos.filter((item) => String(item.id) !== String(id));
      const totalAtualizado = Math.max(0, pagination.total - 1);
      const totalPagesAtualizado = Math.max(1, Math.ceil(Math.max(totalAtualizado, 1) / pagination.limit));
      const paginaAtualizada = Math.min(currentPage, totalPagesAtualizado);

      setProdutos(produtosAtualizados);
      setPagination((prev) => ({
        ...prev,
        total: totalAtualizado,
        totalPages: totalPagesAtualizado,
        page: paginaAtualizada,
        hasNextPage: paginaAtualizada < totalPagesAtualizado,
        hasPreviousPage: paginaAtualizada > 1,
      }));

      if (paginaAtualizada !== currentPage) {
        setCurrentPage(paginaAtualizada);
      }

      notify.success("Produto deletado com sucesso.");
    } catch {
      notify.error("Erro ao conectar no servidor.");
    }
  }

  return (
    <div className="admin-products-list">
      <div className="admin-products-header">
        <div className="admin-list-filters">
          <input
            data-cy="produto-busca"
            type="search"
            className="admin-form-input admin-list-filter-input"
            placeholder="Buscar por nome, ID ou categoria"
            value={filtroBusca}
            onChange={(event) => setFiltroBusca(event.target.value)}
          />
          <select
            data-cy="produto-filtro-categoria"
            className="admin-form-input admin-list-filter-select"
            value={filtroCategoria}
            onChange={(event) => setFiltroCategoria(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
          <select
            data-cy="produto-limit"
            className="admin-form-input admin-list-filter-select"
            value={limit}
            onChange={(event) => { setCurrentPage(1); setLimit(Number(event.target.value) || 10); }}
          >
            <option value={10}>10 por pagina</option>
            <option value={20}>20 por pagina</option>
            <option value={30}>30 por pagina</option>
          </select>
        </div>

        <button data-cy="produto-novo" className="admin-btn-novo" onClick={novoProduto}>
          <Plus size={18} />
          Novo Produto
        </button>
      </div>

      {produtosLoading ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>Carregando produtos...</p>
        </div>
      ) : produtosError ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>{produtosError}</p>
        </div>
      ) : produtos.length === 0 ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>Nenhum produto cadastrado</p>
        </div>
      ) : produtosFiltrados.length === 0 ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>Nenhum produto encontrado para os filtros informados.</p>
        </div>
      ) : (
        <>
          <div className="admin-products-table-wrapper">
            <table data-cy="produto-tabela" className="admin-products-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Custo</th>
                  <th>Preco</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {produtosFiltrados.map((prod) => (
                  <tr key={prod.id} data-cy={`produto-linha-${prod.id}`}>
                    <td data-cy="produto-nome" className="admin-products-nome">{prod.nome}</td>
                    <td data-cy="produto-categoria">{obterNomeCategoria(prod.categoriaId)}</td>
                    <td data-cy="produto-custo">{formatarMoeda(prod.custo)}</td>
                    <td data-cy="produto-preco" className="admin-products-preco">{formatarMoeda(prod.preco)}</td>
                    <td className="admin-products-acoes">
                      <button
                        data-cy={`produto-editar-${prod.id}`}
                        className="admin-products-btn edit"
                        title="Editar"
                        onClick={() => editarProduto(prod)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        data-cy={`produto-deletar-${prod.id}`}
                        className="admin-products-btn delete"
                        onClick={() => deletarProduto(prod.id)}
                        title="Deletar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div data-cy="produto-paginacao" className="admin-list-pagination">
            <div className="admin-list-pagination__meta">
              <div className="admin-form-input admin-list-pagination__status">
                Pagina {pagination.page} de {pagination.totalPages}
              </div>
              <span>{pagination.total} produto(s) no total</span>
            </div>

            <div className="admin-products-acoes">
              <button
                data-cy="produto-anterior"
                className="admin-btn-novo"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!pagination.hasPreviousPage}
              >
                Anterior
              </button>
              <button
                data-cy="produto-proxima"
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

export default AdminProdutoLista;
