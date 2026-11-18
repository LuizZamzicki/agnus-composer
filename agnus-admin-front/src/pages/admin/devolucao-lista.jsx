import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useNotification } from "../../components/notification";
import { apiUrl } from "../../utils/api";
import { apiFetch, formatarMoeda, getAuthHeaders } from "./admin-api";

const FILTROS = [
  { valor: "solicitada", rotulo: "Em análise" },
  { valor: "aprovada", rotulo: "Aguardando a peça" },
  { valor: "recebida", rotulo: "A reembolsar" },
  { valor: "reembolsada", rotulo: "Reembolsadas" },
  { valor: "recusada", rotulo: "Recusadas" },
  { valor: "cancelada", rotulo: "Canceladas pelo cliente" },
  { valor: "", rotulo: "Todas" },
];

// Foto da devolução: a rota exige login, então baixa com o token e mostra por um endereço local.
function FotoDevolucao({ url, indice }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let ativo = true;
    let local = null;
    fetch(apiUrl(url), { headers: getAuthHeaders({ json: false }) })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        local = URL.createObjectURL(blob);
        if (ativo) setSrc(local);
      })
      .catch(() => {});
    return () => {
      ativo = false;
      if (local) URL.revokeObjectURL(local);
    };
  }, [url]);

  const estilo = { width: 44, height: 44, objectFit: "cover", borderRadius: 4, border: "1px solid #ccc", background: "#eee", display: "inline-block" };
  return src ? (
    <a href={src} target="_blank" rel="noreferrer" title={`Abrir foto ${indice}`} data-cy="devolucao-foto-admin">
      <img src={src} alt={`Foto ${indice} enviada pelo cliente`} style={estilo} />
    </a>
  ) : (
    <span style={estilo} aria-hidden="true" />
  );
}

const formatarData = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "-");

// Modal de uma ação: aprovar (instruções + código), recusar (motivo) ou reembolsar (forma + referência).
function ModalAcao({ acao, devolucao, onFechar, onConfirmar, salvando }) {
  const [resposta, setResposta] = useState(
    acao === "aprovar"
      ? "Embale a peça sem uso, com a etiqueta, e poste nos Correios usando o código de postagem abaixo (não há custo para você)."
      : "",
  );
  const [codigo, setCodigo] = useState("");
  const [forma, setForma] = useState("mercado_pago");
  const [referencia, setReferencia] = useState("");

  const titulos = {
    aprovar: "Aprovar devolução",
    recusar: "Recusar devolução",
    reembolsar: `Reembolsar ${formatarMoeda(devolucao.valor_reembolso)}`,
  };

  function confirmar() {
    if (acao === "aprovar") onConfirmar({ resposta_loja: resposta, codigo_postagem: codigo });
    if (acao === "recusar") onConfirmar({ resposta_loja: resposta });
    if (acao === "reembolsar") onConfirmar({ forma, referencia });
  }

  const valido =
    acao === "reembolsar" ? forma === "mercado_pago" || referencia.trim().length > 0 : resposta.trim().length >= 5;

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label={titulos[acao]}>
      <div className="admin-modal-content">
        <h2>{titulos[acao]}</h2>
        <p>Devolução #{devolucao.id_devolucao} · pedido #{devolucao.id_pedido}</p>

        {(acao === "aprovar" || acao === "recusar") && (
          <div className="admin-form-group">
            <label className="admin-form-label">
              {acao === "aprovar" ? "Instruções de envio para o cliente" : "Motivo da recusa (o cliente vai ler)"}
            </label>
            <textarea
              data-cy="devolucao-resposta"
              className="admin-form-input"
              rows={4}
              maxLength={1000}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
            />
          </div>
        )}

        {acao === "aprovar" && (
          <div className="admin-form-group">
            <label className="admin-form-label">Código de postagem / logística reversa (opcional)</label>
            <input
              data-cy="devolucao-codigo"
              className="admin-form-input"
              maxLength={60}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: código de autorização de postagem dos Correios"
            />
          </div>
        )}

        {acao === "reembolsar" && (
          <>
            <div className="admin-form-group">
              <label className="admin-form-label">Forma do reembolso</label>
              <select data-cy="devolucao-forma" className="admin-form-input" value={forma} onChange={(e) => setForma(e.target.value)}>
                <option value="mercado_pago">Estornar pelo Mercado Pago (automático, no PIX ou cartão do cliente)</option>
                <option value="manual">Já reembolsei por fora (PIX ou outro)</option>
              </select>
            </div>
            {forma === "manual" && (
              <div className="admin-form-group">
                <label className="admin-form-label">Referência do reembolso (ex.: id do PIX)</label>
                <input data-cy="devolucao-referencia" className="admin-form-input" maxLength={120} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
              </div>
            )}
          </>
        )}

        <div className="admin-form-actions">
          <button className="admin-form-btn-secondary" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button data-cy="devolucao-confirmar" className="admin-form-btn-primary" onClick={confirmar} disabled={!valido || salvando}>
            {salvando ? "Salvando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminDevolucaoLista() {
  const notify = useNotification();
  const [filtro, setFiltro] = useState("solicitada");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState({ data: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const params = new URLSearchParams({ page: String(pagina), limit: "20" });
      if (filtro) params.set("status", filtro);
      const response = await apiFetch(`/devolucoes?${params}`, { headers: getAuthHeaders() });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErro(json?.message || "Erro ao carregar devoluções.");
        return;
      }
      setDados(json);
    } catch {
      setErro("Erro ao conectar no servidor.");
    } finally {
      setCarregando(false);
    }
  }, [filtro, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function executar(devolucao, acao, corpo = {}) {
    const caminhos = { aprovar: "aprovar", recusar: "recusar", recebida: "recebida", reembolsar: "reembolsar" };
    setSalvando(true);
    try {
      const response = await apiFetch(`/devolucoes/${devolucao.id_devolucao}/${caminhos[acao]}`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(corpo),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(json?.message || "Não foi possível concluir.");
        return;
      }
      notify.success(`Devolução #${devolucao.id_devolucao}: ${json.status_rotulo}.`);
      setModal(null);
      await carregar();
    } catch {
      notify.error("Erro ao conectar no servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function marcarRecebida(devolucao) {
    const ok = await notify.confirm({
      title: "Peça recebida",
      message: `Confirmar que a peça da devolução #${devolucao.id_devolucao} chegou e foi conferida?`,
      confirmText: "Confirmar recebimento",
      cancelText: "Cancelar",
    });
    if (ok) executar(devolucao, "recebida");
  }

  return (
    <div className="admin-products-list" data-cy="admin-devolucoes">
      {modal && (
        <ModalAcao
          acao={modal.acao}
          devolucao={modal.devolucao}
          salvando={salvando}
          onFechar={() => setModal(null)}
          onConfirmar={(corpo) => executar(modal.devolucao, modal.acao, corpo)}
        />
      )}

      <div className="admin-categorias-header">
        <div className="admin-list-filters">
          <select
            data-cy="filtro-devolucao"
            className="admin-form-input admin-list-filter-select"
            value={filtro}
            onChange={(e) => {
              setPagina(1);
              setFiltro(e.target.value);
            }}
          >
            {FILTROS.map((f) => (
              <option key={f.valor || "todas"} value={f.valor}>{f.rotulo}</option>
            ))}
          </select>
        </div>
      </div>

      {carregando ? (
        <div className="admin-products-empty"><p>Carregando devoluções...</p></div>
      ) : erro ? (
        <div className="admin-products-empty"><p>{erro}</p></div>
      ) : dados.data.length === 0 ? (
        <div className="admin-products-empty">
          <RotateCcw size={48} />
          <p>Nenhuma devolução neste filtro.</p>
        </div>
      ) : (
        <>
          <div className="admin-products-table-wrapper">
            <table data-cy="tabela-devolucoes" className="admin-products-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Pedido</th>
                  <th>Peças</th>
                  <th>Motivo</th>
                  <th>Reembolso</th>
                  <th>Status</th>
                  <th>Pedida em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dados.data.map((d) => (
                  <tr key={d.id_devolucao} data-cy="devolucao-row">
                    <td>{d.id_devolucao}</td>
                    <td>#{d.id_pedido}<br /><small>cliente {d.id_usuario}</small></td>
                    <td>
                      {d.itens.map((i) => (
                        <div key={i.id_pedido_item}>
                          {i.quantidade}× {i.nome_produto}{i.tamanho ? ` (${i.tamanho})` : ""}
                        </div>
                      ))}
                    </td>
                    <td>
                      {d.motivo_rotulo}
                      {d.descricao && <><br /><small title={d.descricao}>“{d.descricao.length > 80 ? `${d.descricao.slice(0, 80)}…` : d.descricao}”</small></>}
                      {d.fotos?.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                          {d.fotos.map((f, i) => <FotoDevolucao key={f.id_devolucao_foto} url={f.url} indice={i + 1} />)}
                        </div>
                      )}
                    </td>
                    <td>{formatarMoeda(d.valor_reembolso)}{d.referencia_reembolso && <><br /><small>{d.referencia_reembolso}</small></>}</td>
                    <td>{d.status_rotulo}</td>
                    <td>{formatarData(d.data_solicitacao)}</td>
                    <td>
                      {d.status === "solicitada" && (
                        <>
                          <button data-cy="aprovar-devolucao" className="admin-btn-novo-pedido" onClick={() => setModal({ acao: "aprovar", devolucao: d })}>Aprovar</button>
                          <button data-cy="recusar-devolucao" className="admin-btn-novo-pedido" onClick={() => setModal({ acao: "recusar", devolucao: d })}>Recusar</button>
                        </>
                      )}
                      {d.status === "aprovada" && (
                        <>
                          <button data-cy="receber-devolucao" className="admin-btn-novo-pedido" onClick={() => marcarRecebida(d)}>Peça recebida</button>
                          <button className="admin-btn-novo-pedido" onClick={() => setModal({ acao: "recusar", devolucao: d })}>Recusar</button>
                        </>
                      )}
                      {d.status === "recebida" && (
                        <button data-cy="reembolsar-devolucao" className="admin-btn-novo-pedido" onClick={() => setModal({ acao: "reembolsar", devolucao: d })}>Reembolsar</button>
                      )}
                      {["reembolsada", "recusada", "cancelada"].includes(d.status) && "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-list-pagination">
            <div className="admin-list-pagination__meta">
              <div className="admin-form-input admin-list-pagination__status">
                Página {dados.pagination.page} de {dados.pagination.totalPages}
              </div>
              <span>{dados.pagination.total} devolução(ões)</span>
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

export default AdminDevolucaoLista;
