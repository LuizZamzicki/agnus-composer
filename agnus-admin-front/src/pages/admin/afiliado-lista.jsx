import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useNotification } from "../../components/notification";
import { apiFetch, formatarMoeda, getAuthHeaders } from "./admin-api";

const ABAS = [
  { id: "afiliados", rotulo: "Afiliados" },
  { id: "regras", rotulo: "Regras de comissão" },
  { id: "conversoes", rotulo: "Vendas" },
  { id: "saldos", rotulo: "A pagar" },
  { id: "pagamentos", rotulo: "Pagamentos" },
];

const STATUS_AFILIADO = { pendente: "Pendente", ativo: "Ativo", suspenso: "Suspenso", recusado: "Recusado" };
const STATUS_COMISSAO = {
  aguardando_pagamento: "Aguardando pagamento do pedido",
  pendente: "Pendente",
  aprovada: "Aprovada",
  paga: "Paga",
  cancelada: "Cancelada",
};

const formatarData = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "-");
const hojeMenos = (dias) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

function useApi() {
  const notify = useNotification();

  return useCallback(
    async (caminho, opcoes = {}) => {
      const response = await apiFetch(caminho, { ...opcoes, headers: getAuthHeaders() });
      const dados = response.status === 204 ? {} : await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(dados?.message || "Não foi possível concluir.");
        throw new Error(dados?.message || "erro");
      }
      return dados;
    },
    [notify],
  );
}

function Vazio({ children }) {
  return <div className="admin-products-empty"><p>{children}</p></div>;
}

// ---------------- Afiliados ----------------
function AbaAfiliados() {
  const api = useApi();
  const notify = useNotification();
  const [filtro, setFiltro] = useState("pendente");
  const [lista, setLista] = useState(null);
  const [editandoTaxa, setEditandoTaxa] = useState(null);
  const [taxa, setTaxa] = useState("");

  const carregar = useCallback(async () => {
    setLista(null);
    try {
      setLista((await api(`/afiliados/admin/afiliados${filtro ? `?status=${filtro}` : ""}`)).data);
    } catch {
      setLista([]);
    }
  }, [api, filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function mudarStatus(afiliado, status) {
    const textos = { ativo: "Aprovar", suspenso: "Suspender", recusado: "Recusar" };
    const ok = await notify.confirm({
      title: `${textos[status]} afiliado`,
      message:
        status === "ativo"
          ? `Aprovar "${afiliado.nome_publico}"? Os links dele passam a gerar comissão.`
          : `${textos[status]} "${afiliado.nome_publico}"? Os links continuam levando à loja, mas param de gerar comissão.`,
      confirmText: textos[status],
      cancelText: "Cancelar",
      tone: status === "ativo" ? "default" : "danger",
    });
    if (!ok) return;
    await api(`/afiliados/admin/afiliados/${afiliado.id_afiliado}`, { method: "PATCH", body: JSON.stringify({ status }) });
    notify.success(`${afiliado.nome_publico}: ${STATUS_AFILIADO[status]}.`);
    carregar();
  }

  async function salvarTaxa(afiliado) {
    const valor = taxa.trim() === "" ? null : Number(taxa.replace(",", "."));
    await api(`/afiliados/admin/afiliados/${afiliado.id_afiliado}`, { method: "PATCH", body: JSON.stringify({ taxa_personalizada: valor }) });
    notify.success(valor === null ? "Taxa personalizada removida." : `Taxa de ${valor}% combinada com ${afiliado.nome_publico}.`);
    setEditandoTaxa(null);
    carregar();
  }

  return (
    <>
      <div className="admin-list-filters">
        <select data-cy="filtro-afiliados" className="admin-form-input admin-list-filter-select" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="pendente">Aguardando aprovação</option>
          <option value="ativo">Ativos</option>
          <option value="suspenso">Suspensos</option>
          <option value="recusado">Recusados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {!lista ? <Vazio>Carregando...</Vazio> : lista.length === 0 ? <Vazio>Nenhum afiliado neste filtro.</Vazio> : (
        <div className="admin-products-table-wrapper">
          <table className="admin-products-table" data-cy="tabela-afiliados">
            <thead>
              <tr><th>#</th><th>Afiliado</th><th>Canal</th><th>PIX</th><th>Taxa própria</th><th>A pagar</th><th>Status</th><th>Desde</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id_afiliado} data-cy="afiliado-row">
                  <td>{a.id_afiliado}</td>
                  <td>{a.nome_publico}<br /><small>código {a.codigo} · usuário {a.id_usuario}</small></td>
                  <td>{a.canal ? <small>{a.canal}</small> : "-"}</td>
                  <td>{a.chave_pix ? <small>{a.chave_pix}</small> : <small>não cadastrada</small>}</td>
                  <td>
                    {editandoTaxa === a.id_afiliado ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <input className="admin-form-input" style={{ width: 70 }} value={taxa} placeholder="%" onChange={(e) => setTaxa(e.target.value)} aria-label="Taxa em %" />
                        <button className="admin-btn-novo-pedido" onClick={() => salvarTaxa(a)}>Salvar</button>
                      </span>
                    ) : (
                      <button className="admin-btn-novo-pedido" title="Vazio = segue as regras da loja" onClick={() => { setEditandoTaxa(a.id_afiliado); setTaxa(a.taxa_personalizada ?? ""); }}>
                        {a.taxa_personalizada != null ? `${a.taxa_personalizada}%` : "Regra da loja"}
                      </button>
                    )}
                  </td>
                  <td>{formatarMoeda(a.saldo?.a_receber ?? 0)}</td>
                  <td>{STATUS_AFILIADO[a.status]}</td>
                  <td>{formatarData(a.data_criacao)}</td>
                  <td>
                    {a.status !== "ativo" && <button data-cy="aprovar-afiliado" className="admin-btn-novo-pedido" onClick={() => mudarStatus(a, "ativo")}>Aprovar</button>}
                    {a.status === "pendente" && <button className="admin-btn-novo-pedido" onClick={() => mudarStatus(a, "recusado")}>Recusar</button>}
                    {a.status === "ativo" && <button className="admin-btn-novo-pedido" onClick={() => mudarStatus(a, "suspenso")}>Suspender</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------- Regras ----------------
function AbaRegras() {
  const api = useApi();
  const notify = useNotification();
  const [regras, setRegras] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [nova, setNova] = useState({ tipo: "categoria", referencia_id: "", taxa: "" });
  const [padrao, setPadrao] = useState("");

  const carregar = useCallback(async () => {
    const dados = await api("/afiliados/admin/regras");
    setRegras(dados);
    setPadrao(String(dados.taxa_padrao_em_uso));
  }, [api]);

  useEffect(() => {
    carregar().catch(() => {});
    apiFetch("/categories?limit=100").then((r) => r.json()).then((d) => setCategorias(d.data ?? [])).catch(() => {});
    apiFetch("/products?limit=100").then((r) => r.json()).then((d) => setProdutos(d.data ?? [])).catch(() => {});
  }, [carregar]);

  const nomeDe = (r) =>
    r.tipo === "categoria"
      ? categorias.find((c) => c.id_categoria === r.referencia_id)?.nome ?? `Categoria ${r.referencia_id} (excluída?)`
      : produtos.find((p) => p.id_produto === r.referencia_id)?.nome ?? `Produto ${r.referencia_id}`;

  async function salvar(corpo, mensagem) {
    await api("/afiliados/admin/regras", { method: "PUT", body: JSON.stringify(corpo) });
    notify.success(mensagem);
    carregar();
  }

  async function remover(r) {
    const ok = await notify.confirm({ title: "Remover regra", message: `Remover a regra de ${r.taxa}% de "${nomeDe(r)}"? Vendas já registradas não mudam.`, confirmText: "Remover", tone: "danger" });
    if (!ok) return;
    await api(`/afiliados/admin/regras/${r.id_regra}`, { method: "DELETE" });
    notify.success("Regra removida.");
    carregar();
  }

  if (!regras) return <Vazio>Carregando...</Vazio>;
  const especificas = regras.data.filter((r) => r.tipo !== "padrao");

  return (
    <>
      <p>
        A taxa mais específica vale: <strong>produto</strong> → <strong>categoria</strong> → taxa própria do afiliado → <strong>padrão da loja</strong>.
        Mudanças valem para as próximas vendas; as já registradas guardam a taxa da época.
      </p>

      <div className="admin-form-group">
        <label className="admin-form-label">Taxa padrão da loja (%)</label>
        <div style={{ display: "flex", gap: 8, maxWidth: 320 }}>
          <input data-cy="taxa-padrao" className="admin-form-input" value={padrao} onChange={(e) => setPadrao(e.target.value)} inputMode="decimal" />
          <button className="admin-btn-novo" onClick={() => salvar({ tipo: "padrao", taxa: Number(padrao.replace(",", ".")) }, `Taxa padrão: ${padrao}%.`)}>Salvar</button>
        </div>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label">Nova regra</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select className="admin-form-input" style={{ maxWidth: 160 }} value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value, referencia_id: "" })}>
            <option value="categoria">Categoria</option>
            <option value="produto">Produto</option>
          </select>
          <select data-cy="regra-referencia" className="admin-form-input" style={{ maxWidth: 320 }} value={nova.referencia_id} onChange={(e) => setNova({ ...nova, referencia_id: e.target.value })}>
            <option value="">Escolha…</option>
            {(nova.tipo === "categoria" ? categorias.map((c) => [c.id_categoria, c.nome]) : produtos.map((p) => [p.id_produto, p.nome])).map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
          <input data-cy="regra-taxa" className="admin-form-input" style={{ maxWidth: 100 }} placeholder="%" inputMode="decimal" value={nova.taxa} onChange={(e) => setNova({ ...nova, taxa: e.target.value })} />
          <button
            data-cy="salvar-regra"
            className="admin-btn-novo"
            disabled={!nova.referencia_id || nova.taxa === ""}
            onClick={() => salvar({ tipo: nova.tipo, referencia_id: Number(nova.referencia_id), taxa: Number(nova.taxa.replace(",", ".")) }, "Regra salva.").then(() => setNova({ ...nova, referencia_id: "", taxa: "" }))}
          >
            Adicionar
          </button>
        </div>
      </div>

      {especificas.length === 0 ? <Vazio>Nenhuma regra por categoria ou produto: todos usam a taxa padrão.</Vazio> : (
        <div className="admin-products-table-wrapper">
          <table className="admin-products-table" data-cy="tabela-regras">
            <thead><tr><th>Tipo</th><th>Aplica-se a</th><th>Taxa</th><th></th></tr></thead>
            <tbody>
              {especificas.map((r) => (
                <tr key={r.id_regra}>
                  <td>{r.tipo === "categoria" ? "Categoria" : "Produto"}</td>
                  <td>{nomeDe(r)}</td>
                  <td>{r.taxa}%</td>
                  <td>
                    <button className="admin-products-btn delete" title="Remover regra" aria-label="Remover regra" onClick={() => remover(r)}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------- Vendas (conversões) ----------------
function AbaConversoes() {
  const api = useApi();
  const [filtro, setFiltro] = useState({ dias: 30, status: "" });
  const [dados, setDados] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({ inicio: hojeMenos(filtro.dias), limit: "100" });
    if (filtro.status) params.set("status", filtro.status);
    setDados(null);
    api(`/afiliados/admin/conversoes?${params}`).then(setDados).catch(() => setDados({ data: [], resumo: null }));
  }, [api, filtro]);

  return (
    <>
      <div className="admin-list-filters">
        <select className="admin-form-input admin-list-filter-select" value={filtro.dias} onChange={(e) => setFiltro({ ...filtro, dias: Number(e.target.value) })}>
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
        <select className="admin-form-input admin-list-filter-select" value={filtro.status} onChange={(e) => setFiltro({ ...filtro, status: e.target.value })}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_COMISSAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </div>

      {dados?.resumo && (
        <p data-cy="resumo-conversoes">
          {Object.entries(dados.resumo).map(([status, r]) => `${STATUS_COMISSAO[status]}: ${r.quantidade} (${formatarMoeda(r.comissao)})`).join(" · ")}
        </p>
      )}

      {!dados ? <Vazio>Carregando...</Vazio> : dados.data.length === 0 ? <Vazio>Nenhuma venda de afiliado no período.</Vazio> : (
        <div className="admin-products-table-wrapper">
          <table className="admin-products-table" data-cy="tabela-conversoes">
            <thead><tr><th>Data</th><th>Pedido</th><th>Afiliado</th><th>Peças</th><th>Valor</th><th>Comissão</th><th>Status</th></tr></thead>
            <tbody>
              {dados.data.map((c) => (
                <tr key={c.id_conversao}>
                  <td>{formatarData(c.data_pedido)}</td>
                  <td>#{c.id_pedido}<br /><small>{c.status_pedido}</small></td>
                  <td>{c.id_afiliado}{c.link?.sub_ids?.length ? <><br /><small>{c.link.sub_ids.join(", ")}</small></> : null}</td>
                  <td>{c.itens.map((i) => <div key={`${i.id_produto}-${i.valor}`}><small>{i.quantidade}× {i.nome_produto} ({i.taxa}%)</small></div>)}</td>
                  <td>{formatarMoeda(c.valor_comissionavel)}</td>
                  <td><strong>{formatarMoeda(c.valor_comissao)}</strong></td>
                  <td>
                    {STATUS_COMISSAO[c.status]}
                    {c.status === "pendente" && c.liberada_em && <><br /><small>libera {formatarData(c.liberada_em)}</small></>}
                    {c.motivo_cancelamento && <><br /><small>{c.motivo_cancelamento}</small></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------- A pagar ----------------
function AbaSaldos() {
  const api = useApi();
  const notify = useNotification();
  const [dados, setDados] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [referencia, setReferencia] = useState("");

  const carregar = useCallback(() => api("/afiliados/admin/saldos").then(setDados).catch(() => setDados({ data: [], total_a_pagar: 0 })), [api]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function pagar(s) {
    await api(`/afiliados/admin/afiliados/${s.id_afiliado}/pagamentos`, { method: "POST", body: JSON.stringify({ referencia }) });
    notify.success(`Pagamento de ${formatarMoeda(s.a_receber)} registrado para ${s.nome_publico}.`);
    setPagando(null);
    setReferencia("");
    carregar();
  }

  if (!dados) return <Vazio>Carregando...</Vazio>;

  return (
    <>
      <p>
        Comissões <strong>aprovadas</strong> (pedido entregue e prazo de arrependimento encerrado). Total a pagar: <strong>{formatarMoeda(dados.total_a_pagar)}</strong>.
        Faça o PIX e registre aqui: todas as comissões aprovadas do afiliado viram “paga”.
      </p>

      {pagando && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label="Registrar pagamento">
          <div className="admin-modal-content">
            <h2>Registrar pagamento</h2>
            <p>{pagando.nome_publico}: <strong>{formatarMoeda(pagando.a_receber)}</strong> ({pagando.conversoes} venda(s))</p>
            <p>PIX: <strong>{pagando.chave_pix || "não cadastrado"}</strong></p>
            <div className="admin-form-group">
              <label className="admin-form-label">Comprovante / id do PIX (opcional)</label>
              <input data-cy="pagamento-referencia" className="admin-form-input" maxLength={120} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </div>
            <div className="admin-form-actions">
              <button className="admin-form-btn-secondary" onClick={() => setPagando(null)}>Cancelar</button>
              <button data-cy="confirmar-pagamento" className="admin-form-btn-primary" onClick={() => pagar(pagando)}>Já paguei, registrar</button>
            </div>
          </div>
        </div>
      )}

      {dados.data.length === 0 ? <Vazio>Nada a pagar agora.</Vazio> : (
        <div className="admin-products-table-wrapper">
          <table className="admin-products-table" data-cy="tabela-saldos">
            <thead><tr><th>Afiliado</th><th>Chave PIX</th><th>Vendas</th><th>A pagar</th><th></th></tr></thead>
            <tbody>
              {dados.data.map((s) => (
                <tr key={s.id_afiliado}>
                  <td>{s.nome_publico}</td>
                  <td>{s.chave_pix || <small>não cadastrada</small>}</td>
                  <td>{s.conversoes}</td>
                  <td><strong>{formatarMoeda(s.a_receber)}</strong></td>
                  <td><button data-cy="pagar-afiliado" className="admin-btn-novo-pedido" disabled={!s.chave_pix} title={s.chave_pix ? "" : "Peça ao afiliado para cadastrar a chave PIX"} onClick={() => setPagando(s)}>Registrar pagamento</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------- Pagamentos ----------------
function AbaPagamentos() {
  const api = useApi();
  const [dados, setDados] = useState(null);

  useEffect(() => {
    api("/afiliados/admin/pagamentos").then(setDados).catch(() => setDados({ data: [] }));
  }, [api]);

  if (!dados) return <Vazio>Carregando...</Vazio>;
  if (dados.data.length === 0) return <Vazio>Nenhum pagamento registrado ainda.</Vazio>;

  return (
    <div className="admin-products-table-wrapper">
      <table className="admin-products-table" data-cy="tabela-pagamentos">
        <thead><tr><th>#</th><th>Data</th><th>Afiliado</th><th>Vendas</th><th>Valor</th><th>Referência</th></tr></thead>
        <tbody>
          {dados.data.map((p) => (
            <tr key={p.id_pagamento}>
              <td>{p.id_pagamento}</td>
              <td>{formatarData(p.data_criacao)}</td>
              <td>{p.id_afiliado}</td>
              <td>{p.quantidade_conversoes}</td>
              <td>{formatarMoeda(p.valor)}</td>
              <td>{p.referencia || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminAfiliadoLista() {
  const [aba, setAba] = useState("afiliados");

  return (
    <div className="admin-products-list" data-cy="admin-afiliados">
      <div className="admin-abas" role="tablist" aria-label="Programa de afiliados" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            data-cy={`aba-${a.id}`}
            className={aba === a.id ? "admin-btn-novo" : "admin-form-btn-secondary"}
            onClick={() => setAba(a.id)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === "afiliados" && <AbaAfiliados />}
      {aba === "regras" && <AbaRegras />}
      {aba === "conversoes" && <AbaConversoes />}
      {aba === "saldos" && <AbaSaldos />}
      {aba === "pagamentos" && <AbaPagamentos />}
    </div>
  );
}

export default AdminAfiliadoLista;
