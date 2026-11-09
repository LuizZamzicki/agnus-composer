import { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, PackagePlus, ShoppingBag, Tag, UserPlus, Users } from "lucide-react";
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
  if (!valor) return "Data indisponível";

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

    const nome = item?.nome ?? item?.nome_usuario ?? item?.usuario_nome ?? item?.name ?? item?.username ?? `Usuário ${index + 1}`;
    acoes.push({
      id: `usuario-${item?.id_usuario ?? item?.id ?? index}`,
      titulo: "Novo usuário cadastrado",
      descrição: nome,
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
      descrição: nome,
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
      descrição: nome,
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
        const resposta = await apiFetch("/admin/dashboard", { method: "GET", headers });
        const painel = await resposta.json().catch(() => ({}));

        if (!resposta.ok) {
          if (ativo) setDashboardError(painel?.message || "Erro ao carregar dashboard.");
          return;
        }

        if (!ativo) return;

        const { usuarios, produtos, categorias, pedidos, totais, indisponiveis } = painel;

        if (indisponiveis.length) {
          setDashboardError(`Dados parciais: ${indisponiveis.join(", ")} indisponível no momento.`);
        }

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
          totalUsuarios: totais.usuarios,
          totalProdutos: totais.produtos,
          totalCategorias: totais.categorias,
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
        titulo: "Total de Usuários",
        valor: dashboardStats.totalUsuarios,
        cor: "var(--lit)",
        icone: Users,
      },
      {
        titulo: "Total de Produtos",
        valor: dashboardStats.totalProdutos,
        cor: "var(--brass)",
        icone: BookOpen,
      },
      {
        titulo: "Total de Categorias",
        valor: dashboardStats.totalCategorias,
        cor: "var(--lit)",
        icone: Tag,
      },
      {
        titulo: "Pedidos Abertos",
        valor: dashboardStats.pedidosAbertos,
        cor: "var(--brass)",
        icone: ShoppingBag,
      },
      {
        titulo: "Pedidos Hoje",
        valor: dashboardStats.pedidosHoje,
        cor: "var(--lit)",
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
          <h2>Ultimas Ações</h2>
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
