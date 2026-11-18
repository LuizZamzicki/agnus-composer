import { Ruler } from "lucide-react";

// Modelos de peça: as duas medidas que a fornecedora (YouDraw) informa (largura e altura da peça)
// e os valores dela como referência (cm, peça esticada). Confira na tabela de cada produto.
const LARGURA = { chave: "largura", rotulo: "Largura", descricao: "De uma axila à outra, com a peça esticada." };
const COMPRIMENTO = { chave: "comprimento", rotulo: "Comprimento", descricao: "Do ponto mais alto do ombro até a barra (altura da peça)." };

export const MODELOS_MEDIDAS = {
  camiseta: {
    rotulo: "Camiseta tradicional",
    colunas: [LARGURA, COMPRIMENTO],
    // YouDraw: Camiseta DryFit Basic Masculina
    referencia: { P: [51, 60], M: [53, 64], G: [57, 70], GG: [62, 73] },
  },
  babylook: {
    rotulo: "Baby look (feminina)",
    colunas: [LARGURA, COMPRIMENTO],
    // YouDraw: Camiseta DryFit Basic Feminina
    referencia: { P: [46, 54], M: [46, 55], G: [50, 57], GG: [52, 61] },
  },
  oversized: {
    rotulo: "Oversized",
    colunas: [{ ...LARGURA, descricao: "De uma axila à outra. Modelagem ampla de propósito." }, COMPRIMENTO],
    // YouDraw: Camiseta Oversized Classic
    referencia: { P: [52, 72], M: [54, 74], G: [58, 76], GG: [60, 78], G1: [63, 79], G2: [65, 80] },
  },
  regata: {
    rotulo: "Regata",
    colunas: [
      { chave: "largura", rotulo: "Largura", descricao: "De uma lateral à outra, logo abaixo da cava, com a peça esticada." },
      { chave: "comprimento", rotulo: "Comprimento", descricao: "Do alto da alça até a barra (altura da peça)." },
    ],
    // YouDraw: Tank Top Machão Suedine
    referencia: { P: [52, 72], M: [54, 75], G: [57, 78], GG: [59, 81] },
  },
  short: {
    rotulo: "Short",
    colunas: [
      { chave: "cintura", rotulo: "Largura", descricao: "De uma ponta à outra do cós, com o elástico solto." },
      { chave: "comprimento", rotulo: "Comprimento", descricao: "Do cós até a barra, pela lateral (altura da peça)." },
    ],
    // YouDraw: Short DryFit 2 em 1 Feminino (a versão masculina não tem medidas na planilha)
    referencia: { P: [38, 26], M: [38, 26], G: [42, 32], GG: [42, 32] },
  },
};

// Monta a tabela de um modelo para os tamanhos do produto. Com referência = usa os valores acima.
export function tabelaDoModelo(modelo, tamanhos, comReferencia) {
  const base = MODELOS_MEDIDAS[modelo];
  return {
    modelo,
    colunas: base.colunas,
    linhas: tamanhos.map((tamanho) => {
      const ref = comReferencia ? base.referencia[tamanho.toUpperCase()] : null;
      return { tamanho, valores: Object.fromEntries(base.colunas.map((c, i) => [c.chave, ref ? ref[i] : ""])) };
    }),
    observacao: "",
  };
}

// Células vazias ou inválidas (para avisar antes de salvar).
export function faltasNaTabela(tabela) {
  if (!tabela) return 0;
  return tabela.linhas.reduce(
    (total, linha) => total + tabela.colunas.filter((c) => !(Number(String(linha.valores[c.chave]).replace(",", ".")) > 0)).length,
    0,
  );
}

export default function TabelaMedidasEditor({ tabela, onChange, tamanhos }) {
  const tamanhosDaGrade = tamanhos.filter(Boolean);

  function escolherModelo(modelo) {
    if (!modelo) {
      onChange(null);
      return;
    }
    // Troca de modelo mantém os números já digitados nas medidas que continuam existindo.
    const nova = tabelaDoModelo(modelo, tamanhosDaGrade.length ? tamanhosDaGrade : ["P", "M", "G", "GG"], false);
    if (tabela) {
      nova.linhas = nova.linhas.map((l) => {
        const antiga = tabela.linhas.find((a) => a.tamanho === l.tamanho);
        return antiga ? { ...l, valores: { ...l.valores, ...Object.fromEntries(Object.entries(antiga.valores).filter(([k]) => k in l.valores)) } } : l;
      });
      nova.observacao = tabela.observacao || "";
    }
    onChange(nova);
  }

  function sincronizarTamanhos() {
    onChange({
      ...tabela,
      linhas: tamanhosDaGrade.map(
        (t) => tabela.linhas.find((l) => l.tamanho === t) ?? { tamanho: t, valores: Object.fromEntries(tabela.colunas.map((c) => [c.chave, ""])) },
      ),
    });
  }

  function mudarValor(tamanho, chave, valor) {
    onChange({
      ...tabela,
      linhas: tabela.linhas.map((l) => (l.tamanho === tamanho ? { ...l, valores: { ...l.valores, [chave]: valor } } : l)),
    });
  }

  const tamanhosDiferentes =
    tabela && tamanhosDaGrade.length > 0 && tamanhosDaGrade.join("|") !== tabela.linhas.map((l) => l.tamanho).join("|");
  const faltas = faltasNaTabela(tabela);

  return (
    <div className="admin-form-section" data-cy="editor-medidas">
      <div className="admin-form-header">
        <div>
          <h3>Tabela de medidas</h3>
          <p>Aparece em "Ver medidas" na página do produto. Medidas da peça esticada, em cm.</p>
        </div>
        <div className="admin-form-section-icon-box">
          <Ruler size={24} className="admin-form-section-icon" />
        </div>
      </div>

      <div className="admin-form-group">
        <label className="admin-form-label">Modelo da peça</label>
        <select data-cy="medidas-modelo" className="admin-form-input" value={tabela?.modelo ?? ""} onChange={(e) => escolherModelo(e.target.value)}>
          <option value="">Sem tabela de medidas</option>
          {Object.entries(MODELOS_MEDIDAS).map(([valor, m]) => (
            <option key={valor} value={valor}>{m.rotulo}</option>
          ))}
        </select>
      </div>

      {tabela && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              data-cy="medidas-referencia"
              className="admin-btn-novo-pedido"
              onClick={() => onChange({ ...tabelaDoModelo(tabela.modelo, tabela.linhas.map((l) => l.tamanho), true), observacao: tabela.observacao })}
              title="Valores típicos do mercado. Confira com a tabela da fornecedora."
            >
              Preencher com valores de referência
            </button>
            {tamanhosDiferentes && (
              <button type="button" className="admin-btn-novo-pedido" onClick={sincronizarTamanhos}>
                Usar os tamanhos da grade ({tamanhosDaGrade.join(", ")})
              </button>
            )}
          </div>

          <div className="admin-products-table-wrapper">
            <table className="admin-products-table" data-cy="medidas-grade">
              <thead>
                <tr>
                  <th>Tamanho</th>
                  {tabela.colunas.map((c) => <th key={c.chave} title={c.descricao}>{c.rotulo} (cm)</th>)}
                </tr>
              </thead>
              <tbody>
                {tabela.linhas.map((l) => (
                  <tr key={l.tamanho}>
                    <td><strong>{l.tamanho}</strong></td>
                    {tabela.colunas.map((c) => (
                      <td key={c.chave}>
                        <input
                          className="admin-form-input"
                          style={{ width: 80 }}
                          inputMode="decimal"
                          aria-label={`${c.rotulo} do tamanho ${l.tamanho}`}
                          data-cy={`medida-${l.tamanho}-${c.chave}`}
                          value={l.valores[c.chave] ?? ""}
                          onChange={(e) => mudarValor(l.tamanho, c.chave, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {faltas > 0 && <p style={{ color: "#9b2c1f" }}>{faltas} medida(s) sem preencher.</p>}

          <div className="admin-form-group">
            <label className="admin-form-label">Observação para o cliente (opcional)</label>
            <input
              className="admin-form-input"
              maxLength={300}
              placeholder="Ex.: modelagem justa; se estiver entre dois tamanhos, escolha o maior."
              value={tabela.observacao ?? ""}
              onChange={(e) => onChange({ ...tabela, observacao: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}
