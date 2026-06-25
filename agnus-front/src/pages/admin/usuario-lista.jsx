import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
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

function normalizarUsuario(item, index = 0) {
  return {
    id: item?.id_usuario ?? item?.id ?? item?.user_id ?? `usuario-${index}`,
    nome:
      String(
        item?.nome ??
        item?.nome_usuario ??
        item?.usuario_nome ??
        item?.name ??
        item?.username ??
        ""
      ),
    email: String(
      item?.email ??
      item?.email_usuario ??
      item?.user_email ??
      ""
    ),
    tipo: String(
      item?.tipo ??
      item?.role ??
      item?.perfil ??
      ""
    ).trim().toLowerCase(),
    dataCriacao: item?.data_criacao ?? item?.created_at ?? item?.dataCadastro ?? null,
  };
}

function formatarDataUsuario(valor) {
  if (!valor) return "-";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";

  return data.toLocaleDateString("pt-BR");
}

function formatarTipoUsuario(valor) {
  if (!valor || valor === "-") return "-";

  const mapa = {
    administrador: "Administrador",
    admin: "Administrador",
    cliente: "Cliente",
    usuario: "Usuario",
    user: "Usuario",
  };

  return mapa[String(valor).toLowerCase()] ?? String(valor);
}

function AdminUsuarioLista() {
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosError, setUsuariosError] = useState("");
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosBuscaFiltro, setUsuariosBuscaFiltro] = useState("");
  const [usuariosTipoFiltro, setUsuariosTipoFiltro] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState(PAGINACAO_INICIAL);

  useEffect(() => {

    async function carregarUsuarios() {

      setUsuariosLoading(true);

      try {

        const { response, payload, data, pagination: meta } =
          await fetchJsonPaginado("/users", {
            page: currentPage,
            limit,
            headers: getAuthHeaders(),
            fetcher: apiFetch,
          });


        if (!response.ok) {
          setUsuariosError(
            payload?.message || "Erro ao carregar usuarios."
          );
          return;
        }


        setUsuarios(
          data.map((item, index) =>
            normalizarUsuario(item, index)
          )
        );


        setPagination(meta);


      } catch {

        setUsuariosError(
          "Erro ao conectar no servidor."
        );

      } finally {

        setUsuariosLoading(false);

      }

    }


    carregarUsuarios();


  }, [currentPage, limit]);

  // const usuariosFiltrados = useMemo(() => {

  //   return usuarios.filter((usuario) => {


  //     if (
  //       usuariosTipoFiltro !== "todos" &&
  //       usuario.tipo !== usuariosTipoFiltro
  //     ) {
  //       return false;
  //     }


  //     return true;

  //   });


  // }, [
  //   usuarios,
  //   usuariosTipoFiltro
  // ]);

  const usuariosFiltrados = useMemo(() => {

    return usuarios.filter((usuario) => {

      const termo = usuariosBuscaFiltro.toLowerCase();

      const correspondeBusca =
        usuario.nome.toLowerCase().includes(termo) ||
        usuario.email.toLowerCase().includes(termo) ||
        String(usuario.id).includes(termo) ||
        usuario.tipo.toLowerCase().includes(termo);

      if (!correspondeBusca)
        return false;

      if (
        usuariosTipoFiltro !== "todos" &&
        usuario.tipo !== usuariosTipoFiltro
      ) {
        return false;
      }

      return true;
    });
  }, [
    usuarios,
    usuariosTipoFiltro,
    usuariosBuscaFiltro
  ]);

  return (
    <div className="admin-products-list">
      <div className="admin-products-header">
        <div className="admin-list-filters">
          <input
            data-cy="usuario-busca"
            type="search"
            className="admin-form-input admin-list-filter-input"
            placeholder="Buscar por ID, nome, email ou tipo"
            value={usuariosBuscaFiltro}
            onChange={(e) => setUsuariosBuscaFiltro(e.target.value)}
          />
          <select
            data-cy="usuario-filtro-tipo"
            className="admin-form-input admin-list-filter-select"
            value={usuariosTipoFiltro}
            onChange={(e) => setUsuariosTipoFiltro(e.target.value)}
          >
            <option value="todos">Todos os tipos</option>
            <option value="cliente">Cliente</option>
            <option value="administrador">Administrador</option>
          </select>
          <select
            data-cy="usuario-limit"
            className="admin-form-input admin-list-filter-select"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
          >
            <option value={10}>10 por pagina</option>
            <option value={20}>20 por pagina</option>
            <option value={30}>30 por pagina</option>
          </select>
        </div>
      </div>

      {usuariosLoading ? (
        <div className="admin-products-empty">
          <Users size={48} />
          <p>Carregando usuarios...</p>
        </div>
      ) : usuariosError ? (
        <div className="admin-products-empty">
          <Users size={48} />
          <p>{usuariosError}</p>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="admin-products-empty">
          <Users size={48} />
          <p>Nenhum usuario encontrado</p>
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="admin-products-empty">
          <Users size={48} />
          <p>Nenhum usuario encontrado para os filtros informados.</p>
        </div>
      ) : (
        <>
          <div className="admin-products-table-wrapper">
            <table data-cy="usuario-tabela" className="admin-products-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Tipo</th>
                  <th>Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {
                  usuariosFiltrados.map((usuario) => (
                    <tr
                      data-cy="usuario-item"
                      data-id={usuario.id}
                      key={usuario.id}
                    >

                      <td data-cy="usuario-id">
                        {usuario.id}
                      </td>

                      <td data-cy="usuario-nome">
                        {usuario.nome}
                      </td>

                      <td data-cy="usuario-email">
                        {usuario.email}
                      </td>

                      <td data-cy="usuario-tipo">
                        {formatarTipoUsuario(usuario.tipo)}
                      </td>

                      <td data-cy="usuario-cadastro">
                        {formatarDataUsuario(usuario.dataCriacao)}
                      </td>

                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>

          <div data-cy="usuario-paginacao" className="admin-list-pagination">
            <div className="admin-list-pagination__meta">
              <div className="admin-form-input admin-list-pagination__status">
                Pagina {pagination.page} de {pagination.totalPages}
              </div>
              <span>{pagination.total} usuario(s) no total</span>
            </div>

            <div className="admin-products-acoes">
              <button
                data-cy="usuario-anterior"
                className="admin-btn-novo"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={!pagination.hasPreviousPage}
              >
                Anterior
              </button>
              <button
                data-cy="usuario-proxima"
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

export default AdminUsuarioLista;
