import { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, PackagePlus, ShoppingBag, Tag, UserPlus, Users } from "lucide-react";
import { fetchJsonPaginado, extrairListaResposta } from "../../utils/pagination";
import { apiFetch, getAuthHeaders } from "./admin-api";

function isMesmoDia(dataA, dataB) {
  return (
    dataA.getFullYear() === dataB.getFullYear() &&
    dataA.getMonth() === dataB.getMonth() &&
    dataA.getDate() === dataB.getDate()
  );
}

function obterDataValida(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function formatarDataHora(valor) {
  if (!valor) return "Data indisponivel";

  return valor.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function criarAcoesRecentes(usuarios, pedidos, produtos, categorias) {
  const acoes = [];

  usuarios.forEach((item, index) => {
    const data = obterDataValida(item?.data_criacao ?? item?.created_at ?? item?.dataCadastro);
    if (!data) return;

    const nome = item?.nome ?? item?.nome_usuario ?? item?.usuario_nome ?? item?.name ?? item?.username ?? `Usuario ${index + 1}`;
    acoes.push({
      id: `usuario-${item?.id_usuario ?? item?.id ?? index}`,
      titulo: "Novo usuario cadastrado",
      descricao: nome,
      data,
      icone: UserPlus,
    });
  });

  pedidos.forEach((item, index) => {
    const data = obterDataValida(item?.data_criacao ?? item?.created_at ?? item?.dataPedido);
    if (!data) return;

    const identificador = item?.id_pedido ?? item?.id ?? item?.pedido_id ?? index + 1;
    const cliente =
      item?.cliente_nome ?? item?.nome_cliente ?? item?.cliente ?? item?.usuario_nome ?? item?.nome_usuario ?? "cliente";
    acoes.push({
      id: `pedido-${identificador}`,
      titulo: "Novo pedido recebido",
      descricao: `Pedido #${identificador} de ${cliente}`,
      data,
      icone: ShoppingBag,
    });
  });

  produtos.forEach((item, index) => {
    const data = obterDataValida(item?.data_criacao ?? item?.created_at ?? item?.dataCadastro);
    if (!data) return;

    const nome = item?.nome ?? item?.produto_nome ?? `Produto ${index + 1}`;
    acoes.push({
      id: `produto-${item?.id_produto ?? item?.id ?? index}`,
      titulo: "Novo produto cadastrado",
      descricao: nome,
      data,
      icone: PackagePlus,
    });
  });

  categorias.forEach((item, index) => {
    const data = obterDataValida(item?.data_criacao ?? item?.created_at ?? item?.dataCadastro);
    if (!data) return;

    const nome = item?.nome ?? item?.categoria ?? item?.categoria_nome ?? `Categoria ${index + 1}`;
    acoes.push({
      id: `categoria-${item?.id_categoria ?? item?.id ?? index}`,
      titulo: "Nova categoria cadastrada",
      descricao: nome,
      data,
      icone: Tag,
    });
  });

  return acoes.sort((a, b) => b.data.getTime() - a.data.getTime()).slice(0, 10);
}

function AdminDashboard() {
  const [dashboardStats, setDashboardStats] = useState({
    totalUsuarios: 0,
    totalProdutos: 0,
    totalCategorias: 0,
    pedidosAbertos: 0,
    pedidosHoje: 0,
  });
  const [acoesRecentes, setAcoesRecentes] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarDashboard() {
      setDashboardError("");
      setDashboardLoading(true);

      try {
        const headers = getAuthHeaders();
        const [usuariosRes, produtosRes, categoriasRes, pedidosRes] = await Promise.all([
          fetchJsonPaginado("/users", {
            page: 1,
            limit: 10,
            headers,
            fetcher: apiFetch,
          }),
          fetchJsonPaginado("/products", {
            page: 1,
            limit: 10,
            headers,
            fetcher: apiFetch,
          }),
          fetchJsonPaginado("/categories", {
            page: 1,
            limit: 10,
            headers,
            fetcher: apiFetch,
          }),
          apiFetch("/orders", { method: "GET", headers }),
        ]);

        const pedidosRaw = await pedidosRes.json().catch(() => []);

        if (!usuariosRes.response.ok || !produtosRes.response.ok || !categoriasRes.response.ok || !pedidosRes.ok) {
          if (!ativo) return;
          const message =
            usuariosRes.payload?.message ||
            produtosRes.payload?.message ||
            categoriasRes.payload?.message ||
            pedidosRaw?.message ||
            "Erro ao carregar dashboard.";
          setDashboardError(message);
          return;
        }

        if (!ativo) return;

        const usuarios = usuariosRes.data;
        const produtos = produtosRes.data;
        const categorias = categoriasRes.data;
        const pedidos = extrairListaResposta(pedidosRaw);
        const hoje = new Date();

        const pedidosAbertos = pedidos.filter((pedido) => {
          const status = pedido?.status ?? pedido?.status_pedido;
          return status !== "entregue" && status !== "cancelado";
        }).length;

        const pedidosHoje = pedidos.filter((pedido) => {
          const dataPedido = obterDataValida(pedido?.data_criacao ?? pedido?.created_at ?? pedido?.dataPedido);
          return dataPedido ? isMesmoDia(dataPedido, hoje) : false;
        }).length;

        setDashboardStats({
          totalUsuarios: usuariosRes.pagination.total,
          totalProdutos: produtosRes.pagination.total,
          totalCategorias: categoriasRes.pagination.total,
          pedidosAbertos,
          pedidosHoje,
        });
        setAcoesRecentes(criarAcoesRecentes(usuarios, pedidos, produtos, categorias));
      } catch {
        if (ativo) setDashboardError("Erro ao conectar no servidor.");
      } finally {
        if (ativo) setDashboardLoading(false);
      }
    }

    carregarDashboard();
    return () => {
      ativo = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        titulo: "Total de Usuarios",
        valor: dashboardStats.totalUsuarios,
        cor: "#c04b31",
        icone: Users,
      },
      {
        titulo: "Total de Produtos",
        valor: dashboardStats.totalProdutos,
        cor: "#7b6a4f",
        icone: BookOpen,
      },
      {
        titulo: "Total de Categorias",
        valor: dashboardStats.totalCategorias,
        cor: "#c04b31",
        icone: Tag,
      },
      {
        titulo: "Pedidos Abertos",
        valor: dashboardStats.pedidosAbertos,
        cor: "#7b6a4f",
        icone: ShoppingBag,
      },
      {
        titulo: "Pedidos Hoje",
        valor: dashboardStats.pedidosHoje,
        cor: "#c04b31",
        icone: Activity,
      },
    ],
    [dashboardStats]
  );

  return (
    <div className="admin-dashboard-home">
      <div className="admin-stats admin-stats--dashboard">
        {cards.map((card) => {
          const Icone = card.icone;
          return (
            <div data-cy="dashboard-card" key={card.titulo} className="admin-stat-card" style={{ borderTopColor: card.cor }}>
              <Icone className="admin-stat-icon" size={32} />
              <div className="admin-stat-info">
                <span className="admin-stat-label">{card.titulo}</span>
                <span className="admin-stat-value">{dashboardLoading ? "-" : card.valor}</span>
              </div>
            </div>
          );
        })}
      </div>

      {dashboardError && (
        <div className="admin-section__empty">
          <p>{dashboardError}</p>
        </div>
      )}

      <section className="admin-section">
        <div data-cy="dashboard-title" className="admin-section__header">
          <h2>Ultimas Acoes</h2>
        </div>

        {acoesRecentes.length === 0 ? (
          <div className="admin-section__empty">
            <p>Nenhuma atividade recente encontrada.</p>
          </div>
        ) : (
          <div className="admin-activity-list">
            {acoesRecentes.map((acao) => {
              const Icone = acao.icone;
              return (
                <div data-cy="atividade-item" key={acao.id} className="admin-activity-item">
                  <div className="admin-activity-icon-wrap">
                    <Icone className="admin-activity-icon" size={18} />
                  </div>
                  <div className="admin-activity-content">
                    <strong>{acao.titulo}</strong>
                    <p>{acao.descricao}</p>
                  </div>
                  <span className="admin-activity-date">{formatarDataHora(acao.data)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminDashboard;
