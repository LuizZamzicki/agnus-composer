import { useEffect, useMemo, useState } from "react";
import { Package, Pencil } from "lucide-react";
import { apiFetch, formatarMoeda, formatarStatus, getAuthHeaders } from "./admin-api";

function normalizarListaResposta(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.pedidos)) return payload.pedidos;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function normalizarPedido(item, index = 0) {
  return {
    id: item?.id_pedido ?? item?.id ?? item?.pedido_id ?? `pedido-${index}`,
    cliente:
      item?.cliente_nome ??
      item?.nome_cliente ??
      item?.cliente ??
      item?.usuario_nome ??
      item?.nome_usuario ??
      item?.id_usuario ??
      "-",
    status: item?.status ?? item?.status_pedido ?? "-",
    total: item?.valor_total ?? item?.total ?? item?.preco_total ?? item?.valor ?? "-",
    dataCriacao: item?.data_criacao ?? item?.created_at ?? item?.dataPedido ?? null,
  };
}

function formatarDataPedido(valor) {
  if (!valor) return "-";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";

  return data.toLocaleDateString("pt-BR");
}

function AdminPedidoLista() {
  const [pedidosStatusFiltro, setPedidosStatusFiltro] = useState("todos");
  const [pedidosBuscaFiltro, setPedidosBuscaFiltro] = useState("");
  const [pedidosPage, setPedidosPage] = useState(1);
  const [pedidosPageSize, setPedidosPageSize] = useState(10);
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [pedidosError, setPedidosError] = useState("");
  const [pedidos, setPedidos] = useState([]);

  const [pedidoEditando, setPedidoEditando] = useState(null);
  const [novoStatus, setNovoStatus] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarPedidos() {
      setPedidosError("");
      setPedidosLoading(true);

      try {
        const params = new URLSearchParams();
        if (pedidosStatusFiltro && pedidosStatusFiltro !== "todos") {
          params.set("status", pedidosStatusFiltro);
        }
        const query = params.toString();

        const response = await apiFetch(`/orders${query ? `?${query}` : ""}`, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        const data = await response.json().catch(() => []);
        if (!response.ok) {
          if (ativo) setPedidosError(data?.message || "Erro ao carregar pedidos.");
          return;
        }

        if (ativo) {
          const lista = normalizarListaResposta(data).map((item, index) => normalizarPedido(item, index));
          setPedidos(lista);
        }
      } catch {
        if (ativo) setPedidosError("Erro ao conectar no servidor.");
      } finally {
        if (ativo) setPedidosLoading(false);
      }
    }

    carregarPedidos();
    return () => {
      ativo = false;
    };
  }, [pedidosStatusFiltro]);

  async function salvarStatus(idPedido) {
    try {
      const response = await apiFetch(`/orders/${idPedido}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          status: novoStatus,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        alert(data?.message || "Erro ao atualizar pedido.");
        return;
      }

      setPedidos((prev) =>
        prev.map((pedido) =>
          pedido.id === idPedido
            ? { ...pedido, status: novoStatus }
            : pedido
        )
      );

      setPedidoEditando(null);
      setNovoStatus("");
    } catch {
      alert("Erro ao conectar no servidor.");
    }
  }

  const pedidosFiltrados = useMemo(() => {
    const busca = pedidosBuscaFiltro.trim().toLowerCase();
    if (!busca) return pedidos;

    return pedidos.filter((pedido) => {
      return (
        String(pedido.id).toLowerCase().includes(busca) ||
        String(pedido.cliente).toLowerCase().includes(busca) ||
        formatarStatus(pedido.status).toLowerCase().includes(busca)
      );
    });
  }, [pedidos, pedidosBuscaFiltro]);

  useEffect(() => {
    setPedidosPage(1);
  }, [pedidosStatusFiltro, pedidosBuscaFiltro, pedidosPageSize]);

  const pedidosTotalPaginas = useMemo(
    () => Math.max(1, Math.ceil(pedidosFiltrados.length / pedidosPageSize)),
    [pedidosFiltrados.length, pedidosPageSize]
  );

  const pedidosPageSafe = Math.min(pedidosPage, pedidosTotalPaginas);

  const pedidosPaginados = useMemo(() => {
    const inicio = (pedidosPageSafe - 1) * pedidosPageSize;
    return pedidosFiltrados.slice(inicio, inicio + pedidosPageSize);
  }, [pedidosFiltrados, pedidosPageSafe, pedidosPageSize]);

  return (
    <div className="admin-products-list">
      <div className="admin-products-header">
        <div className="admin-list-filters">
          <input
            data-cy="buscar-pedido"
            type="search"
            className="admin-form-input admin-list-filter-input"
            placeholder="Buscar por ID, cliente ou status"
            value={pedidosBuscaFiltro}
            onChange={(e) => setPedidosBuscaFiltro(e.target.value)}
          />
          <select
            data-cy="filtro-status-pedido"
            className="admin-form-input admin-list-filter-select"
            value={pedidosStatusFiltro}
            onChange={(e) => setPedidosStatusFiltro(e.target.value)}
          >
            <option value="todos">Todos os status</option>
            <option value="aguardando_calculo_frete">Aguardando calculo do frete</option>
            <option value="aguardando_pagamento">Aguardando pagamento</option>
            <option value="pago">Pago</option>
            <option value="enviado">Enviado</option>
            <option value="entregue">Entregue</option>
            <option value="cancelado">Cancelado</option>
          </select>
          <select
            className="admin-form-input admin-list-filter-select"
            value={pedidosPageSize}
            onChange={(e) => setPedidosPageSize(Number(e.target.value))}
          >
            <option value={5}>5 por pagina</option>
            <option value={10}>10 por pagina</option>
            <option value={20}>20 por pagina</option>
          </select>
        </div>
      </div>

      {pedidosLoading ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>Carregando pedidos...</p>
        </div>
      ) : pedidosError ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>{pedidosError}</p>
        </div>
      ) : pedidos.length === 0 ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>Nenhum pedido encontrado</p>
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="admin-products-empty">
          <Package size={48} />
          <p>Nenhum pedido encontrado para os filtros informados.</p>
        </div>
      ) : (
        <>
          <div data-cy="tabela-pedidos" className="admin-products-table-wrapper">
            <table className="admin-products-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pedidosPaginados.map((pedido) => (
                  <tr data-cy="pedido-row" key={pedido.id}>
                    <td>{pedido.id}</td>
                    <td>{pedido.cliente}</td>
                    <td>
                      {pedidoEditando === pedido.id ? (
                        <select data-cy="novo-status-pedido" value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)}>
                          <option value="aguardando_calculo_frete">
                            Aguardando frete
                          </option>
                          <option value="aguardando_pagamento">
                            Aguardando pagamento
                          </option>
                          <option value="pago">
                            Pago
                          </option>
                          <option value="enviado">
                            Enviado
                          </option>
                          <option value="entregue">
                            Entregue
                          </option>
                          <option value="cancelado">
                            Cancelado
                          </option>
                        </select>
                      ) : (
                        formatarStatus(pedido.status)
                      )}
                    </td>

                    <td>{formatarMoeda(pedido.total)}</td>
                    <td>{formatarDataPedido(pedido.dataCriacao)}</td>

                    <td>
                      {pedidoEditando === pedido.id ? (
                        <>
                          <button data-cy="salvar-status-pedido" className="admin-btn-novo-pedido" onClick={() => salvarStatus(pedido.id)}>
                            Salvar
                          </button>

                          <button
                            data-cy="cancelar-status-pedido"
                            className="admin-btn-novo-pedido" onClick={() => setPedidoEditando(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          data-cy="editar-pedido"
                          className="admin-btn-novo-pedido"
                          onClick={() => {
                            setPedidoEditando(pedido.id);
                            setNovoStatus(
                              pedido.status
                            );
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-products-header">
            <div className="admin-list-filters admin-list-filters--single">
              <div className="admin-form-input">
                Pagina {pedidosPageSafe} de {pedidosTotalPaginas}
              </div>
            </div>

            <div className="admin-products-acoes">
              <button
                className="admin-btn-novo"
                onClick={() => setPedidosPage(Math.max(1, pedidosPageSafe - 1))}
                disabled={pedidosPageSafe <= 1}
              >
                Anterior
              </button>
              <button
                className="admin-btn-novo"
                onClick={() => setPedidosPage(Math.min(pedidosTotalPaginas, pedidosPageSafe + 1))}
                disabled={pedidosPageSafe >= pedidosTotalPaginas}
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

export default AdminPedidoLista;
