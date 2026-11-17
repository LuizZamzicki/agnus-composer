import { useState } from "react";
import { apiFetch, getAuthHeaders } from "./admin-api";

const MAX_BYTES = 5 * 1024 * 1024;

const lerComoBase64 = (arquivo) =>
  new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).replace(/^data:[^;,]*;base64,/, ""));
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });

// Anexar, trocar ou remover a NF-e do pedido. Com o XML, chave, número, série, data e valor vêm
// dele; só com o PDF, a chave de acesso (44 números) é digitada. O cliente é avisado na primeira vez.
export default function NotaFiscalModal({ pedido, onFechar, onSalvo }) {
  const atual = pedido.notaFiscal;
  const [pdf, setPdf] = useState(null);
  const [xml, setXml] = useState(null);
  const [chave, setChave] = useState("");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function escolher(arquivo, setar) {
    setErro("");
    if (arquivo && arquivo.size > MAX_BYTES) {
      setErro("Arquivo muito grande (máximo de 5 MB).");
      setar(null);
      return;
    }
    setar(arquivo || null);
  }

  async function salvar() {
    setErro("");
    if (!pdf && !xml && !atual) {
      setErro("Anexe o PDF (DANFE) ou o XML da nota.");
      return;
    }
    if (!xml && !atual && chave.replace(/\D/g, "").length !== 44) {
      setErro("Sem o XML, digite a chave de acesso (44 números).");
      return;
    }

    setSalvando(true);
    try {
      const corpo = {
        ...(chave.trim() ? { chave } : {}),
        ...(pdf ? { pdf: await lerComoBase64(pdf) } : {}),
        ...(xml ? { xml: await lerComoBase64(xml) } : {}),
      };
      const res = await apiFetch(`/notas-fiscais/${pedido.id}`, { method: "PUT", headers: getAuthHeaders(), body: JSON.stringify(corpo) });
      const dados = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(dados?.message || "Não foi possível salvar a nota.");
        return;
      }
      onSalvo(dados);
    } catch {
      setErro("Erro ao conectar no servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover() {
    if (!window.confirm(`Remover a nota fiscal do pedido #${pedido.id}? O cliente deixa de vê-la.`)) return;
    setSalvando(true);
    try {
      const res = await apiFetch(`/notas-fiscais/${pedido.id}`, { method: "DELETE", headers: getAuthHeaders() });
      if (!res.ok && res.status !== 404) {
        const dados = await res.json().catch(() => ({}));
        setErro(dados?.message || "Não foi possível remover a nota.");
        return;
      }
      onSalvo(null);
    } catch {
      setErro("Erro ao conectar no servidor.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label={`Nota fiscal do pedido ${pedido.id}`}>
      <div className="admin-modal-content" data-cy="modal-nota-fiscal">
        <h2>Nota fiscal (NF-e)</h2>
        <p>Pedido #{pedido.id} · {pedido.cliente}</p>

        {atual && (
          <p className="nota-fiscal-atual" data-cy="nota-fiscal-atual">
            Anexada: {atual.numero ? `nº ${atual.numero}` : "sem número"} · chave {atual.chave_formatada || atual.chave}
            <br />
            {[atual.tem_pdf && "PDF", atual.tem_xml && "XML"].filter(Boolean).join(" e ") || "sem arquivo"}. Envie de novo para trocar.
          </p>
        )}

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="nf-xml">XML da nota (recomendado: preenche chave, número e valor)</label>
          <input id="nf-xml" data-cy="nota-fiscal-xml" className="admin-form-input" type="file" accept=".xml,text/xml,application/xml" onChange={(e) => escolher(e.target.files?.[0], setXml)} />
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="nf-pdf">DANFE em PDF (o que o cliente abre)</label>
          <input id="nf-pdf" data-cy="nota-fiscal-pdf" className="admin-form-input" type="file" accept=".pdf,application/pdf" onChange={(e) => escolher(e.target.files?.[0], setPdf)} />
        </div>

        {!xml && (
          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="nf-chave">Chave de acesso {atual ? "(opcional)" : "(obrigatória sem o XML)"}</label>
            <input
              id="nf-chave"
              data-cy="nota-fiscal-chave"
              className="admin-form-input"
              inputMode="numeric"
              maxLength={60}
              placeholder="44 números"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
            />
          </div>
        )}

        {erro && <p className="nota-fiscal-erro" role="alert" data-cy="nota-fiscal-erro">{erro}</p>}

        <div className="admin-form-actions">
          {atual && (
            <button type="button" className="admin-form-btn-secondary" onClick={remover} disabled={salvando} data-cy="nota-fiscal-remover">
              Remover nota
            </button>
          )}
          <button type="button" className="admin-form-btn-secondary" onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="button" className="admin-form-btn-primary" onClick={salvar} disabled={salvando} data-cy="nota-fiscal-salvar">
            {salvando ? "Salvando…" : "Salvar nota"}
          </button>
        </div>
      </div>
    </div>
  );
}
