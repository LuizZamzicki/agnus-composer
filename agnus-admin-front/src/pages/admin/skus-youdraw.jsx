import { useCallback, useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { useNotification } from "../../components/notification";
import { apiFetch, getAuthHeaders } from "./admin-api";

// SKU da YouDraw de cada cor + tamanho do produto: é o que a YouDraw usa para saber qual peça
// produzir quando o pedido pago é criado lá. Só aparece na edição (o produto precisa existir).
export default function SkusYouDraw({ idProduto }) {
  const notify = useNotification();
  const [dados, setDados] = useState(null);
  const [skus, setSkus] = useState({});
  const [candidatos, setCandidatos] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const chave = (c) => `${c.cor}|${c.tamanho}`;

  const aplicar = useCallback((resumo) => {
    setDados(resumo);
    setSkus(Object.fromEntries(resumo.combinacoes.map((c) => [chave(c), c.sku ?? ""])));
  }, []);

  const carregar = useCallback(async () => {
    const response = await apiFetch(`/products/${idProduto}/skus`, { headers: getAuthHeaders() });
    const json = await response.json().catch(() => ({}));
    if (response.ok) aplicar(json);
  }, [idProduto, aplicar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    setOcupado(true);
    try {
      const response = await apiFetch(`/products/${idProduto}/skus`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ skus: dados.combinacoes.map((c) => ({ cor: c.cor, tamanho: c.tamanho, sku: skus[chave(c)] ?? "" })) }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(json?.message || "Não foi possível salvar os SKUs.");
        return;
      }
      aplicar(json);
      notify.success("SKUs da YouDraw salvos.");
    } finally {
      setOcupado(false);
    }
  }

  async function buscar(idYouDraw) {
    setOcupado(true);
    try {
      const response = await apiFetch(`/products/${idProduto}/skus/importar`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(idYouDraw ? { id_produto_fornecedor: idYouDraw } : {}),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(json?.message || "Não foi possível buscar na YouDraw.");
        return;
      }
      if (json.precisa_escolher) {
        setCandidatos(json.candidatos ?? []);
        notify.warning(json.mensagem);
        return;
      }
      setCandidatos(null);
      aplicar(json.resumo);
      notify.success(
        `${json.associados} combinação(ões) ligada(s) a "${json.produto_youdraw?.nome}".` +
          (json.sem_par?.length ? ` Sem par na YouDraw: ${json.sem_par.map((c) => `${c.cor} ${c.tamanho}`).join(", ")}.` : ""),
      );
    } finally {
      setOcupado(false);
    }
  }

  if (!dados) return null;

  return (
    <div className="admin-form-section" data-cy="skus-youdraw">
      <div className="admin-form-header">
        <div>
          <h3>SKUs da YouDraw</h3>
          <p>
            Ligue cada cor e tamanho ao SKU do produto na YouDraw. Quando o pedido é pago, a loja cria o pedido lá com esses SKUs.
            {dados.faltando > 0 && <strong> Faltam {dados.faltando} — pedidos com essas combinações não vão para a YouDraw.</strong>}
          </p>
        </div>
        <div className="admin-form-section-icon-box">
          <Link2 size={24} className="admin-form-section-icon" />
        </div>
      </div>

      {!dados.integracao_ativa && (
        <p data-cy="youdraw-desligada" style={{ color: "#8a6a10" }}>
          Integração desligada (sem chave da API no servidor). Dá para preencher os SKUs à mão; o botão de busca funciona quando a chave for configurada.
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button type="button" data-cy="buscar-skus" className="admin-btn-novo-pedido" disabled={ocupado || !dados.integracao_ativa} onClick={() => buscar()}>
          Buscar na YouDraw
        </button>
        {candidatos && (
          <select data-cy="candidato-youdraw" className="admin-form-input" style={{ width: "auto" }} defaultValue="" onChange={(e) => e.target.value && buscar(e.target.value)}>
            <option value="">Qual é este produto na YouDraw?</option>
            {candidatos.map((c) => <option key={c.id} value={c.id}>{c.nome} ({c.status})</option>)}
          </select>
        )}
      </div>

      {dados.combinacoes.length === 0 ? (
        <p>Cadastre as cores e as grades e salve o produto para ligar os SKUs.</p>
      ) : (
        <>
          <div className="admin-products-table-wrapper">
            <table className="admin-products-table" data-cy="grade-skus">
              <thead><tr><th>Cor</th><th>Tamanho</th><th>SKU na YouDraw</th></tr></thead>
              <tbody>
                {dados.combinacoes.map((c) => (
                  <tr key={chave(c)}>
                    <td>{c.cor}</td>
                    <td>{c.tamanho}</td>
                    <td>
                      <input
                        className="admin-form-input"
                        data-cy={`sku-${c.cor}-${c.tamanho}`}
                        aria-label={`SKU da YouDraw para ${c.cor} ${c.tamanho}`}
                        placeholder="ex.: ABC-PRETO-M"
                        value={skus[chave(c)] ?? ""}
                        onChange={(e) => setSkus({ ...skus, [chave(c)]: e.target.value })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" data-cy="salvar-skus" className="admin-btn-novo" style={{ marginTop: 12 }} disabled={ocupado} onClick={salvar}>
            Salvar SKUs
          </button>
        </>
      )}
    </div>
  );
}
