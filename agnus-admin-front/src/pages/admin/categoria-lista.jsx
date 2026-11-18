import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  const [excluindoId, setExcluindoId] = useState(null);
  // Categoria em edição (null = o modal está cadastrando uma nova).
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const [recarregar, setRecarregar] = useState(0);

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
  }, [currentPage, limit, recarregar]);

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
    setCategoriaEditando(null);
  }

  function abrirEdicao(categoria) {
    setCategoriaEditando(categoria);
    setNovaCategoriaNome(categoria.nome);
    setIsCategoriaModalOpen(true);
  }

  async function salvarCategoria() {
    if (categoriaEditando) {
      await editarCategoria();
    } else {
      await cadastrarCategoria();
    }
  }

  async function editarCategoria() {
    const nome = novaCategoriaNome.trim();
    if (!nome) {
      notify.warning("Digite o nome da categoria.");
      return;
    }

    if (nome === categoriaEditando.nome) {
      fecharModalCategoria();
      return;
    }

    setSalvandoCategoria(true);
    try {
      const response = await apiFetch(`/categories/${categoriaEditando.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ nome }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify.error(data?.message || "Erro ao editar categoria.");
        setSalvandoCategoria(false);
        return;
      }

      // Os produtos da categoria passam a mostrar o nome novo (o catálogo e a busca são atualizados).
      setCategorias((lista) => lista.map((c) => (c.id === categoriaEditando.id ? { ...c, nome: data?.nome ?? nome } : c)));
      notify.success(`Categoria renomeada para "${data?.nome ?? nome}".`);
      fecharModalCategoria();
    } catch {
      notify.error("Erro ao conectar no servidor.");
      setSalvandoCategoria(false);
    }
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

  async function chamarExclusao(id, moverProdutos) {
    const response = await apiFetch(`/categories/${id}${moverProdutos ? "?mover_produtos=true" : ""}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
    return { response, data };
  }

  async function excluirCategoria(categoria) {
    const confirmado = await notify.confirm({
      title: "Excluir categoria",
      message: `Excluir a categoria "${categoria.nome}"? Essa ação não pode ser desfeita.`,
      confirmText: "Excluir",
      cancelText: "Cancelar",
      tone: "danger",
    });
    if (!confirmado) return;

    setExcluindoId(categoria.id);
    try {
      let { response, data } = await chamarExclusao(categoria.id, false);

      // A categoria tem produtos: o servidor diz quantos e só exclui com a segunda confirmação.
      if (response.status === 409 && data?.produtos) {
        const mover = await notify.confirm({
          title: "Categoria com produtos",
          message: `${data.produtos} produto(s) estão em "${categoria.nome}". Eles continuam à venda, mas ficam "Sem categoria". Deseja excluir mesmo assim?`,
          confirmText: "Excluir e manter os produtos",
          cancelText: "Cancelar",
          tone: "danger",
        });
        if (!mover) return;
        ({ response, data } = await chamarExclusao(categoria.id, true));
      }

      if (!response.ok) {
        notify.error(data?.message || "Erro ao excluir categoria.");
        return;
      }

      notify.success("Categoria excluída.");
      // Se era a última da página, volta uma página.
      if (categorias.length === 1 && currentPage > 1) {
        setCurrentPage((pagina) => pagina - 1);
      } else {
        setRecarregar((n) => n + 1);
      }
    } catch {
      notify.error("Erro ao conectar no servidor.");
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <div className="admin-products-list">
      {isCategoriaModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2>{categoriaEditando ? "Editar Categoria" : "Nova Categoria"}</h2>
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
                    salvarCategoria();
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
                onClick={salvarCategoria}
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
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
            <option value={30}>30 por página</option>
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
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {categoriasFiltradas.map((categoria) => (
                  <tr data-cy="categoria-item" key={categoria.id}>
                    <td>{categoria.id}</td>
                    <td>{categoria.nome}</td>
                    <td>
                      <button
                        type="button"
                        data-cy={`categoria-editar-${categoria.id}`}
                        className="admin-products-btn edit"
                        onClick={() => abrirEdicao(categoria)}
                        title="Editar categoria"
                        aria-label={`Editar a categoria ${categoria.nome}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        data-cy={`categoria-excluir-${categoria.id}`}
                        className="admin-products-btn delete"
                        onClick={() => excluirCategoria(categoria)}
                        disabled={excluindoId === categoria.id}
                        title="Excluir categoria"
                        aria-label={`Excluir a categoria ${categoria.nome}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-list-pagination">
            <div className="admin-list-pagination__meta">
              <div className="admin-form-input admin-list-pagination__status">
                Página {pagination.page} de {pagination.totalPages}
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
