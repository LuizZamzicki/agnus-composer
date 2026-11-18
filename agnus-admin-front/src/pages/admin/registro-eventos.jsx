import { Fragment, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { History } from "lucide-react";
import { apiFetch, getAuthHeaders } from "./admin-api";

const CATEGORIAS = {
  pedido: { rotulo: "Pedido", cor: "#2f6a46" },
  pagamento: { rotulo: "Venda / pagamento", cor: "#1f5fa8" },
  email: { rotulo: "E-mail", cor: "#7a4fb0" },
  aviso: { rotulo: "Aviso no site", cor: "#8a6a10" },
  devolucao: { rotulo: "Devolução", cor: "#b0562a" },
  afiliado: { rotulo: "Afiliado", cor: "#0f7b7b" },
  catalogo: { rotulo: "Catálogo", cor: "#5e5a54" },
  usuario: { rotulo: "Usuário", cor: "#5e5a54" },
  sistema: { rotulo: "Sistema", cor: "#5e5a54" },
};

const RESULTADOS = {
  sucesso: { rotulo: "OK", cor: "#2f6a46" },
  falha: { rotulo: "Falhou", cor: "#9b2c1f" },
  ignorado: { rotulo: "Não feito", cor: "#8a6a10" },
};

const FILTROS_INICIAIS = { categoria: "", resultado: "", id_pedido: "", id_usuario: "", inicio: "", fim: "" };

const dataHora = (valor) =>
  new Date(valor).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

function Etiqueta({ texto, cor }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 12, color: "#fff", background: cor, whiteSpace: "nowrap" }}>
      {texto}
    </span>
  );
}

function AdminRegistroEventos() {
  const location = useLocation();
  const navigate = useNavigate();
  const daUrl = Object.fromEntries(new URLSearchParams(location.search));
  const [filtros, setFiltros] = useState({ ...FILTROS_INICIAIS, ...(daUrl.pedido ? { id_pedido: daUrl.pedido } : {}) });
  const [aplicados, setAplicados] = useState(filtros);
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(null);

  const carregar = useCallback(async () => {
    setDados(null);
    setErro("");
    const params = new URLSearchParams({ page: String(pagina), limit: "50" });
    Object.entries(aplicados).forEach(([k, v]) => v && params.set(k, String(v).trim()));
    try {
      const response = await apiFetch(`/notifications/registro?${params}`, { headers: getAuthHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErro(json?.message || "Erro ao carregar o registro.");
        setDados({ data: [], pagination: { page: 1, totalPages: 1, total: 0 } });
        return;
      }
      setDados(json);
    } catch {
      setErro("Erro ao conectar no servidor.");
    }
  }, [aplicados, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function aplicar(e) {
    e.preventDefault();
    setPagina(1);
    setAplicados(filtros);
    navigate(filtros.id_pedido ? `/admin/eventos?pedido=${filtros.id_pedido}` : "/admin/eventos", { replace: true });
  }

  function limpar() {
    setFiltros(FILTROS_INICIAIS);
    setAplicados(FILTROS_INICIAIS);
    setPagina(1);
    navigate("/admin/eventos", { replace: true });
  }

  const campo = (nome) => ({ value: filtros[nome], onChange: (e) => setFiltros({ ...filtros, [nome]: e.target.value }) });

  return (
    <div className="admin-products-list" data-cy="admin-registro">
      <p>
        Tudo o que aconteceu no sistema fica registrado aqui: pedidos, vendas, e-mails enviados (ou que falharam), avisos no site,
        devoluções e afiliação. Filtre por pedido para ver a história completa de uma compra.
      </p>

      <form onSubmit={aplicar} className="admin-list-filters" style={{ flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <select data-cy="registro-categoria" className="admin-form-input admin-list-filter-select" style={{ width: "auto" }} {...campo("categoria")}>
          <option value="">Todos os tipos</option>
          {Object.entries(CATEGORIAS).map(([v, c]) => <option key={v} value={v}>{c.rotulo}</option>)}
        </select>
        <select className="admin-form-input admin-list-filter-select" style={{ width: "auto" }} {...campo("resultado")}>
          <option value="">Qualquer resultado</option>
          <option value="sucesso">OK</option>
          <option value="falha">Falhou</option>
          <option value="ignorado">Não feito</option>
        </select>
        <input data-cy="registro-pedido" className="admin-form-input" style={{ width: 130 }} placeholder="Pedido nº" inputMode="numeric" {...campo("id_pedido")} />
        <input className="admin-form-input" style={{ width: 130 }} placeholder="Cliente (id)" inputMode="numeric" {...campo("id_usuario")} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          De <input className="admin-form-input" type="date" style={{ width: 160 }} {...campo("inicio")} />
        </label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          Até <input className="admin-form-input" type="date" style={{ width: 160 }} {...campo("fim")} />
        </label>
        <button type="submit" className="admin-btn-novo" data-cy="registro-filtrar">Filtrar</button>
        <button type="button" className="admin-form-btn-secondary" onClick={limpar}>Limpar</button>
      </form>

      {erro && <div className="admin-products-empty"><p>{erro}</p></div>}
      {!dados && !erro && <div className="admin-products-empty"><p>Carregando...</p></div>}
      {dados && dados.data.length === 0 && !erro && (
        <div className="admin-products-empty">
          <History size={48} />
          <p>Nenhum acontecimento com esses filtros.</p>
        </div>
      )}

      {dados && dados.data.length > 0 && (
        <>
          <div className="admin-products-table-wrapper">
            <table className="admin-products-table" data-cy="tabela-registro">
              <thead>
                <tr><th>Quando</th><th>Tipo</th><th style={{ minWidth: 320 }}>O que aconteceu</th><th>Pedido</th><th>Cliente</th><th>Resultado</th><th></th></tr>
              </thead>
              <tbody>
                {dados.data.map((r) => {
                  const cat = CATEGORIAS[r.categoria] ?? CATEGORIAS.sistema;
                  const res = RESULTADOS[r.resultado] ?? RESULTADOS.sucesso;
                  return (
                    <Fragment key={r.id_registro}>
                      <tr data-cy="registro-linha">
                        <td style={{ whiteSpace: "nowrap" }}>{dataHora(r.ocorrido_em)}</td>
                        <td><Etiqueta texto={cat.rotulo} cor={cat.cor} /></td>
                        <td style={{ minWidth: 320 }}>{r.descricao}</td>
                        <td>
                          {r.id_pedido ? (
                            <button
                              type="button"
                              className="admin-btn-novo-pedido"
                              title="Ver só este pedido"
                              onClick={() => {
                                const novo = { ...FILTROS_INICIAIS, id_pedido: String(r.id_pedido) };
                                setFiltros(novo);
                                setAplicados(novo);
                                setPagina(1);
                                navigate(`/admin/eventos?pedido=${r.id_pedido}`, { replace: true });
                              }}
                            >
                              #{r.id_pedido}
                            </button>
                          ) : "-"}
                        </td>
                        <td>{r.id_usuario ?? "-"}</td>
                        <td><Etiqueta texto={res.rotulo} cor={res.cor} /></td>
                        <td>
                          <button type="button" className="admin-btn-novo-pedido" aria-expanded={aberto === r.id_registro} onClick={() => setAberto(aberto === r.id_registro ? null : r.id_registro)}>
                            {aberto === r.id_registro ? "Fechar" : "Detalhes"}
                          </button>
                        </td>
                      </tr>
                      {aberto === r.id_registro && (
                        <tr>
                          <td colSpan={7}>
                            <small>
                              Código: <code>{r.tipo}</code> · Origem: {r.origem || "-"}
                              {r.request_id ? <> · Requisição: <code>{r.request_id}</code></> : null}
                              {r.id_devolucao ? <> · Devolução #{r.id_devolucao}</> : null}
                            </small>
                            <pre style={{ margin: "8px 0 0", padding: 12, background: "#f4f1ec", borderRadius: 6, overflowX: "auto", fontSize: 12 }}>
                              {JSON.stringify(r.dados ?? {}, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="admin-list-pagination">
            <div className="admin-list-pagination__meta">
              <div className="admin-form-input admin-list-pagination__status">Página {dados.pagination.page} de {dados.pagination.totalPages}</div>
              <span>{dados.pagination.total} registro(s)</span>
            </div>
            <div className="admin-products-acoes">
              <button className="admin-btn-novo" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={!dados.pagination.hasPreviousPage}>Anterior</button>
              <button className="admin-btn-novo" onClick={() => setPagina((p) => p + 1)} disabled={!dados.pagination.hasNextPage}>Proxima</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminRegistroEventos;
