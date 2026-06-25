import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Grid3x3, Palette, Plus, Upload, X } from "lucide-react";
import { useNotification } from "../../components/notification";
import { assetUrl } from "../../utils/api";
import { fetchJsonPaginado } from "../../utils/pagination";
import { apiFetch, getAuthHeaders } from "./admin-api";

function normalizarCategoria(item, index = 0) {
  return {
    id: item?.id ?? item?.id_categoria ?? item?.categoria_id ?? `categoria-${index}`,
    nome: item?.nome ?? item?.categoria ?? item?.categoria_nome ?? "-",
  };
}

function normalizarValorCor(valor) {
  if (typeof valor !== "string") return "";
  const cor = valor.trim();
  if (!cor) return "";

  const ehHex = /^#([\da-f]{3}|[\da-f]{6})$/i.test(cor);
  const ehRgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:\d*\.\d+|\d+))?\s*\)$/i.test(cor);
  const ehHsl = /^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:\d*\.\d+|\d+))?\s*\)$/i.test(cor);

  return ehHex || ehRgb || ehHsl ? cor : "";
}

function extrairTonalidadeCor(cor) {
  const candidatas = [
    cor?.tonalidade,
    cor?.rgb,
    cor?.rgb_cor,
    cor?.cor_rgb,
    cor?.color_rgb,
    cor?.tonalidade_rgb,
    cor?.codigo_rgb,
    cor?.hex,
    cor?.codigo_hex,
    cor?.hex_color,
    cor?.cor_hex,
    cor?.color,
    cor?.colour,
  ];

  for (const valor of candidatas) {
    const normalizada = normalizarValorCor(valor);
    if (normalizada) return normalizada;
  }

  return "#1f1f1f";
}

function converterCorParaRgb(valorCor) {
  if (typeof valorCor !== "string") return "";

  const cor = valorCor.trim();
  if (!cor) return "";

  const hexMatch = cor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((char) => `${char}${char}`)
        .join("");
    }

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  const rgbMatch = cor.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:\d*\.\d+|\d+))?\s*\)$/i
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, Number(rgbMatch[1])));
    const g = Math.min(255, Math.max(0, Number(rgbMatch[2])));
    const b = Math.min(255, Math.max(0, Number(rgbMatch[3])));
    return `rgb(${r}, ${g}, ${b})`;
  }

  return cor;
}

function lerArquivoComoDataUrl(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(new Error(`Falha ao ler o arquivo ${arquivo?.name || ""}`.trim()));
    };

    reader.readAsDataURL(arquivo);
  });
}

function normalizarUrlImagem(url) {
  if (typeof url !== "string") return "";

  const valor = url.trim();
  if (!valor) return "";

  if (/^(?:https?:|data:|blob:)/i.test(valor)) {
    return valor;
  }

  return assetUrl(valor);
}

function AdminProdutoCadastro() {
  const navigate = useNavigate();
  const notify = useNotification();
  const location = useLocation();
  const matchEdicao = location.pathname.match(/\/admin\/produtos\/editar\/([^/]+)/);
  const produtoEdicaoId = matchEdicao ? matchEdicao[1] : null;

  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [categorias, setCategorias] = useState([]);

  const [produto, setProduto] = useState({
    nome: "",
    descricao: "",
    custo: "",
    precoVenda: "",
    categoria: "",
  });

  const [grades, setGrades] = useState([]);
  const [novaGrade, setNovaGrade] = useState({ nome: "", acrescimo: "" });

  const [cores, setCores] = useState([]);
  const [novaCor, setNovaCor] = useState({ nome: "", tonalidade: "#c04b31", acrescimo: "" });
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);

  async function carregarCategorias() {
    try {
      const { response, data } = await fetchJsonPaginado("/categories", {
        page: 1,
        limit: 100,
        headers: getAuthHeaders(),
        fetcher: apiFetch,
      });

      if (response.ok) {
        setCategorias(data.map((item, index) => normalizarCategoria(item, index)));
      }
    } catch {
      // noop
    }
  }

  function resetFormulario() {
    setProduto({
      nome: "",
      descricao: "",
      custo: "",
      precoVenda: "",
      categoria: "",
    });
    setGrades([]);
    setCores([]);
    setNovaGrade({ nome: "", acrescimo: "" });
    setNovaCor({ nome: "", tonalidade: "#c04b31", acrescimo: "" });
  }

  function adicionarGrade() {
    if (novaGrade.nome.trim()) {
      setGrades((prev) => [...prev, { id: Date.now(), ...novaGrade }]);
      setNovaGrade({ nome: "", acrescimo: "" });
    }
  }

  function removerGrade(id) {
    setGrades((prev) => prev.filter((g) => g.id !== id));
  }

  function atualizarGradeAcrescimo(id, acrescimo) {
    setGrades((prev) => prev.map((g) => (g.id === id ? { ...g, acrescimo } : g)));
  }

  function adicionarCor() {
    if (novaCor.nome.trim()) {
      setCores((prev) => [...prev, { id: Date.now(), ...novaCor, fotos: [] }]);
      setNovaCor({ nome: "", tonalidade: "#c04b31", acrescimo: "" });
    }
  }

  function removerCor(id) {
    setCores((prev) => prev.filter((c) => c.id !== id));
  }

  function atualizarCorAcrescimo(id, acrescimo) {
    setCores((prev) => prev.map((c) => (c.id === id ? { ...c, acrescimo } : c)));
  }

  function handleCorFotosChange(corId, e) {
    if (e.target.files) {
      const novasFotos = Array.from(e.target.files);
      setCores((prev) =>
        prev.map((cor) =>
          cor.id === corId ? { ...cor, fotos: [...(cor.fotos || []), ...novasFotos] } : cor
        )
      );
    }
  }

  function removerCorFoto(corId, fotoIndex) {
    setCores((prev) =>
      prev.map((cor) =>
        cor.id === corId
          ? { ...cor, fotos: (cor.fotos || []).filter((_, index) => index !== fotoIndex) }
          : cor
      )
    );
  }

  function parseJsonArraySeguro(valor) {
    if (Array.isArray(valor)) return valor;
    if (typeof valor !== "string") return [];
    try {
      const parsed = JSON.parse(valor);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function extrairUrlsFotos(entrada) {
    const fotos = Array.isArray(entrada) ? entrada : parseJsonArraySeguro(entrada);
    return fotos
      .map((foto) => {
        if (typeof foto === "string") return normalizarUrlImagem(foto);
        if (!foto || typeof foto !== "object") return "";
        return normalizarUrlImagem(
          foto.url ||
          foto.src ||
          foto.path ||
          foto.caminho ||
          foto.foto ||
          foto.imagem ||
          foto.foto_url ||
          foto.caminho_url ||
          foto.image_url ||
          foto.imagem_url ||
          foto.arquivo_url ||
          foto.caminho_arquivo ||
          ""
        );
      })
      .filter(Boolean);
  }

  function obterPreviewFoto(foto) {
    if (foto instanceof File) {
      return URL.createObjectURL(foto);
    }
    if (typeof foto === "string") {
      return normalizarUrlImagem(foto);
    }
    return "";
  }

  function normalizarListaResposta(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.rows)) return payload.rows;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.fotos)) return payload.fotos;
    if (Array.isArray(payload?.photos)) return payload.photos;
    if (Array.isArray(payload?.resultados)) return payload.resultados;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  function deduplicarStrings(lista = []) {
    return [...new Set(lista.filter(Boolean))];
  }

  useEffect(() => {
    carregarCategorias();
  }, []);

  useEffect(() => {
    let ativo = true;

    async function carregarProdutoEdicao() {
      if (!produtoEdicaoId) {
        resetFormulario();
        return;
      }

      setCarregandoEdicao(true);
      try {
        const headers = getAuthHeaders();

        const [produtoRes, gradesRes, coresRes, fotosRes] = await Promise.all([
          apiFetch(`/products/${produtoEdicaoId}`, { method: "GET", headers }),
          apiFetch(`/product-grades/${produtoEdicaoId}`, { method: "GET", headers }),
          apiFetch(`/product-colors/${produtoEdicaoId}`, { method: "GET", headers }),
          apiFetch(`/product-photos/${produtoEdicaoId}`, { method: "GET", headers }),
        ]);

        const [produtoData, gradesRaw, coresRaw, fotosRaw] = await Promise.all([
          produtoRes.json().catch(() => ({})),
          gradesRes.json().catch(() => ([])),
          coresRes.json().catch(() => ([])),
          fotosRes.json().catch(() => ([])),
        ]);

        if (!produtoRes.ok) {
          notify.error(produtoData?.message || "Erro ao carregar produto para edicao.");
          return;
        }

        if (!ativo) return;

        const gradesData = normalizarListaResposta(gradesRaw);
        const coresData = normalizarListaResposta(coresRaw);
        const fotosData = normalizarListaResposta(fotosRaw);

        const precoCusto = produtoData?.preco_custo ?? produtoData?.custo ?? "";
        const precoBase = produtoData?.preco_base ?? produtoData?.preco ?? produtoData?.precoVenda ?? "";

        setProduto({
          nome: produtoData?.nome ?? "",
          descricao: produtoData?.descricao ?? "",
          custo: precoCusto === null || precoCusto === undefined ? "" : String(precoCusto),
          precoVenda: precoBase === null || precoBase === undefined ? "" : String(precoBase),
          categoria: produtoData?.id_categoria ?? produtoData?.categoria_id ?? "",
        });

        const gradesOriginais =
          gradesData.length > 0
            ? gradesData
            : parseJsonArraySeguro(produtoData?.grades ?? produtoData?.tamanhos ?? produtoData?.sizes);

        setGrades(
          gradesOriginais
            .map((grade, index) => ({
              id: grade?.id ?? grade?.id_grade ?? Date.now() + index,
              nome: (grade?.nome ?? grade?.label ?? grade?.descricao ?? grade?.tamanho ?? "")
                .toString()
                .trim(),
              acrescimo:
                grade?.acrescimo === null || grade?.acrescimo === undefined
                  ? ""
                  : String(grade.acrescimo),
            }))
            .filter((grade) => grade.nome)
        );

        const coresOriginais =
          coresData.length > 0
            ? coresData
            : parseJsonArraySeguro(produtoData?.cores ?? produtoData?.colors ?? produtoData?.variacoes_cores);

        const coresNormalizadas = coresOriginais
          .map((cor, index) => ({
            id: cor?.id ?? cor?.id_cor ?? cor?.id_produto_cor ?? Date.now() + index + 1000,
            nome: (cor?.nome ?? cor?.label ?? cor?.cor ?? "").toString().trim(),
            tonalidade: extrairTonalidadeCor(cor),
            acrescimo:
              cor?.acrescimo === null || cor?.acrescimo === undefined ? "" : String(cor.acrescimo),
            fotos: extrairUrlsFotos(cor?.fotos ?? cor?.imagens ?? cor?.images),
          }))
          .filter((cor) => cor.nome);

        const coresComFotos = coresNormalizadas.map((cor) => {
          const fotosDaCor = fotosData
            .filter((foto) => {
              const idCorFoto =
                foto?.id_produto_cor ?? foto?.id_cor ?? foto?.id_color ?? foto?.cor_id ?? foto?.idCor;

              if (idCorFoto !== undefined && idCorFoto !== null) {
                return String(idCorFoto) === String(cor.id);
              }

              const nomeCorFoto = (foto?.nome_cor ?? foto?.cor ?? foto?.color ?? "")
                .toString()
                .trim()
                .toLowerCase();

              return nomeCorFoto && nomeCorFoto === cor.nome.toLowerCase();
            })
            .map((foto) =>
              normalizarUrlImagem(
                foto?.caminho ?? foto?.path ?? foto?.url ?? foto?.src ?? foto?.foto ?? foto?.imagem ?? foto?.foto_url ?? foto?.caminho_url ?? foto?.image_url ?? foto?.imagem_url ?? foto?.arquivo_url ?? foto?.caminho_arquivo
              )
            )
            .filter(Boolean);

          return {
            ...cor,
            fotos: deduplicarStrings([...(cor.fotos || []), ...fotosDaCor]),
          };
        });

        const fotosSemCor = fotosData
          .filter((foto) => {
            const idCorFoto =
              foto?.id_produto_cor ?? foto?.id_cor ?? foto?.id_color ?? foto?.cor_id ?? foto?.idCor;
            return idCorFoto === undefined || idCorFoto === null;
          })
          .map((foto) =>
            normalizarUrlImagem(
              foto?.caminho ?? foto?.path ?? foto?.url ?? foto?.src ?? foto?.foto ?? foto?.imagem ?? foto?.foto_url ?? foto?.caminho_url ?? foto?.image_url ?? foto?.imagem_url ?? foto?.arquivo_url ?? foto?.caminho_arquivo
            )
          )
          .filter(Boolean);

        if (fotosSemCor.length > 0 && coresComFotos.length > 0) {
          coresComFotos[0] = {
            ...coresComFotos[0],
            fotos: deduplicarStrings([...(coresComFotos[0].fotos || []), ...fotosSemCor]),
          };
        }

        setCores(coresComFotos);
      } catch {
        if (ativo) {
          notify.error("Erro ao conectar no servidor.");
        }
      } finally {
        if (ativo) {
          setCarregandoEdicao(false);
        }
      }
    }

    carregarProdutoEdicao();
    return () => {
      ativo = false;
    };
  }, [produtoEdicaoId, notify]);

  async function salvarNovaCategoria() {
    if (!novaCategoriaNome.trim()) {
      notify.warning("Por favor, digite o nome da categoria.");
      return;
    }

    try {
      const response = await apiFetch(`/categories`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          nome: novaCategoriaNome,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify.error(data?.message || "Erro ao salvar categoria.");
        return;
      }

      setIsCategoriaModalOpen(false);
      setNovaCategoriaNome("");
      await carregarCategorias();

      if (data.id) {
        setProduto((prev) => ({ ...prev, categoria: data.id }));
      }

      notify.success("Categoria salva com sucesso!");
    } catch {
      notify.error("Erro ao conectar no servidor.");
    }
  }

  async function salvarProdutoComFotos() {
    if (!produto.nome.trim()) {
      notify.warning("Por favor, preencha o nome do produto");
      return;
    }

    const precoBase = produto.precoVenda !== "" ? parseFloat(produto.precoVenda) : undefined;
    if (precoBase === undefined || Number.isNaN(precoBase)) {
      notify.warning("Por favor, preencha o preço de venda");
      return;
    }

    const gradesValidas = grades.filter((grade) => (grade?.nome || "").trim() !== "");

    if (gradesValidas.length === 0) {
      notify.warning("Adicione pelo menos uma grade para o produto.");
      return;
    }

    const coresValidas = cores.filter((cor) => {
      const nomeValido = (cor?.nome || "").trim() !== "";
      const fotos = Array.isArray(cor?.fotos) ? cor.fotos : [];

      return nomeValido && fotos.length > 0;
    });

    if (coresValidas.length === 0) {
      notify.warning(
        "Adicione pelo menos uma cor com pelo menos uma foto para o produto."
      );
      return;
    }

    const idCategoriaNumero =
      produto.categoria !== "" && !Number.isNaN(Number(produto.categoria))
        ? Number(produto.categoria)
        : null;

    const gradesPayload = grades
      .map((grade) => ({
        nome: (grade?.nome || "").trim(),
        acrescimo: grade?.acrescimo === "" ? 0 : Number(grade?.acrescimo) || 0,
      }))
      .filter((grade) => grade.nome);

    const emEdicao = Boolean(produtoEdicaoId);
    const rota = emEdicao ? `/products/${produtoEdicaoId}` : "/products";
    const metodo = emEdicao ? "PUT" : "POST";

    try {
      let uploadIndex = 0;
      const coresPayload = (
        await Promise.all(
          cores.map(async (cor, corIndex) => {
            const nome = (cor?.nome || "").trim();
            const fotosLista = Array.isArray(cor?.fotos) ? cor.fotos : [];

            const fotosUrls = fotosLista
              .filter((foto) => typeof foto === "string" && foto.trim())
              .map((foto) => foto.trim());

            const fotosUpload = await Promise.all(
              fotosLista
                .filter((foto) => foto instanceof File)
                .map(async (arquivo) => {
                  const uploadAtual = uploadIndex;
                  uploadIndex += 1;

                  return {
                    upload_index: uploadAtual,
                    cor_index: corIndex,
                    nome_original: arquivo.name,
                    tipo_arquivo: arquivo.type || null,
                    tamanho_bytes: arquivo.size || 0,
                    arquivo_base64: await lerArquivoComoDataUrl(arquivo),
                  };
                })
            );

            return {
              nome,
              tonalidade: converterCorParaRgb(cor?.tonalidade) || null,
              acrescimo: cor?.acrescimo === "" ? 0 : Number(cor?.acrescimo) || 0,
              fotos: fotosUrls,
              fotos_upload: fotosUpload,
            };
          })
        )
      ).filter((cor) => cor.nome);

      const payload = {
        nome: produto.nome,
        descricao: produto.descricao || null,
        preco_custo: parseFloat(produto.custo) || 0,
        preco_base: precoBase,
        ativo: true,
        grades: gradesPayload,
        cores: coresPayload,
      };

      if (idCategoriaNumero) {
        payload.id_categoria = idCategoriaNumero;
      }

      const resumoFotos = coresPayload.map((cor) => ({
        cor: cor.nome,
        urls_existentes: cor.fotos,
        uploads_novos: cor.fotos_upload.length,
      }));
      console.log(`[CADASTRO JSON] ${metodo} ${rota} fotos:`, resumoFotos);

      const response = await apiFetch(rota, {
        method: metodo,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        notify.error(data?.message || (emEdicao ? "Erro ao atualizar produto." : "Erro ao salvar produto."));
        return;
      }

      if (!emEdicao) {
        resetFormulario();
      }

      notify.success(emEdicao ? "Produto atualizado com sucesso!" : "Produto salvo com sucesso!");
      navigate("/admin/produtos");
    } catch {
      notify.error("Erro ao conectar no servidor.");
    }
  }
  return (
    <div className="admin-produtos-form">
      {isCategoriaModalOpen && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2>Nova Categoria</h2>
            <div className="admin-form-group">
              <label className="admin-form-label">Nome da Categoria</label>
              <input
                data-cy="nova-categoria-nome"
                type="text"
                className="admin-form-input"
                placeholder="Ex.: Vestidos"
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
              />
            </div>
            <div className="admin-form-actions">
              <button
                data-cy="cancelar-categoria"
                className="admin-form-btn-secondary"
                onClick={() => setIsCategoriaModalOpen(false)}
              >
                Cancelar
              </button>
              <button data-cy="salvar-categoria" className="admin-form-btn-primary" onClick={salvarNovaCategoria}>
                Salvar
              </button>
            </div>
          </div >
        </div >
      )
      }

      <div className="admin-form-section">
        <div className="admin-form-group full">
          <label className="admin-form-label">Nome do Produto</label>
          <input
            type="text"
            className="admin-form-input"
            placeholder="Ex.: Vestido Aurora Prism"
            value={produto.nome}
            onChange={(e) => setProduto({ ...produto, nome: e.target.value })}
            data-cy="produto-nome"
          />
        </div>

        <div className="admin-form-group full">
          <label className="admin-form-label">Descricao do Produto</label>
          <textarea
            data-cy="produto-descricao"
            className="admin-form-textarea"
            placeholder="Descreva acabamentos, materiais nobres e narrativa da peca"
            value={produto.descricao}
            onChange={(e) => setProduto({ ...produto, descricao: e.target.value })}
            rows="5"
          />
        </div>

        <div className="admin-form-row">
          <div className="admin-form-group">
            <label className="admin-form-label">Custo</label>
            <div className="admin-form-input-prefix">
              <span>R$</span>
              <input
                data-cy="produto-custo"
                type="number"
                placeholder="0,00"
                step="0.01"
                value={produto.custo}
                onChange={(e) => setProduto({ ...produto, custo: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Preco de Venda</label>
            <div className="admin-form-input-prefix">
              <span>R$</span>
              <input
                data-cy="produto-preco-venda"
                type="number"
                placeholder="0,00"
                step="0.01"
                value={produto.precoVenda}
                onChange={(e) => setProduto({ ...produto, precoVenda: e.target.value })}
              />
            </div>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">Categoria</label>
            <div className="admin-input-group">
              <select
                data-cy="produto-categoria"
                className="admin-form-input"
                value={produto.categoria}
                onChange={(e) => setProduto({ ...produto, categoria: e.target.value })}
              >
                <option key="sem-categoria" value="">
                  Sem categoria
                </option>
                {categorias.map((categoria, index) => (
                  <option key={`${categoria.id ?? "sem-id"}-${index}`} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
              <button
                data-cy="abrir-modal-categoria"
                type="button"
                className="admin-btn-add-inline"
                onClick={() => setIsCategoriaModalOpen(true)}
                title="Adicionar nova categoria"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-form-section admin-form-section--grades">
        <div className="admin-form-header">
          <div>
            <h3>Grades</h3>
            <p>Defina grades disponiveis</p>
          </div>
          <div className="admin-form-section-icon-box">
            <Grid3x3 size={24} className="admin-form-section-icon" />
          </div>
        </div>

        {grades.length === 0 ? (
          <div className="admin-form-empty">
            <p>Nenhuma grade cadastrada.</p>
          </div>
        ) : (
          <div className="admin-form-items admin-grade-grid">
            {grades.map((grade) => (
              <div data-cy="grade-item" key={grade.id} className="admin-grade-card">
                <div className="admin-grade-card-head">
                  <div className="admin-grade-card-title-wrap">
                    <span className="admin-grade-card-title">{grade.nome}</span>
                    <span className="admin-grade-card-subtitle">Acrescimo opcional</span>
                  </div>
                  <button
                    data-cy="remover-grade"
                    className="admin-grade-card-remove"
                    onClick={() => removerGrade(grade.id)}
                    aria-label={`Remover grade ${grade.nome}`}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="admin-grade-card-value">
                  <span>R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="+0,00"
                    value={grade.acrescimo}
                    onChange={(e) => atualizarGradeAcrescimo(grade.id, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="admin-grade-new-section">
          <div className="admin-form-row admin-grade-new-form">
            <div className="admin-form-group">
              <label className="admin-form-label">Nome da Grade</label>
              <input
                data-cy="nova-grade-nome"
                type="text"
                className="admin-form-input"
                placeholder="PP"
                value={novaGrade.nome}
                onChange={(e) =>
                  setNovaGrade({
                    ...novaGrade,
                    nome: e.target.value
                  })
                }
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Acrescimo</label>
              <div className="admin-form-input-prefix">
                <span>+</span>
                <input
                  data-cy="nova-grade-acrescimo"
                  type="number"
                  placeholder="0,00"
                  step="0.01"
                  value={novaGrade.acrescimo}
                  onChange={(e) => setNovaGrade({ ...novaGrade, acrescimo: e.target.value })}
                />
              </div>
            </div>

            <button data-cy="adicionar-grade" className="admin-form-btn-add" onClick={adicionarGrade}>
              <Plus size={18} />
              Adicionar grade
            </button>
          </div>
        </div >
      </div >

      <div className="admin-form-section">
        <div className="admin-form-header">
          <div>
            <h3>Cores</h3>
            <p>
              Cadastre as cores disponiveis para este produto. Cada cor precisa ter pelo menos
              uma foto.
            </p>
          </div>
          <Palette size={24} className="admin-form-section-icon" />
        </div>

        {cores.length === 0 ? (
          <div className="admin-form-empty">
            <p>
              Nenhuma cor cadastrada. Primeiro adicione a cor no painel abaixo; depois voce podera
              anexar as fotos.
            </p>
          </div>
        ) : (
          <div className="admin-form-items admin-color-grid">
            {cores.map((cor) => (
              <div key={cor.id} className="admin-form-color-card">
                <div
                  className="admin-form-color-card-top"
                  style={{ backgroundColor: cor.tonalidade }}
                >
                  <span className="admin-form-color-hex">
                    {(cor.tonalidade || "").toUpperCase()}
                  </span>
                </div>

                <div className="admin-form-color-card-body">
                  <div className="admin-form-color-head">
                    <h4 className="admin-form-color-name">{cor.nome}</h4>
                    <button
                      data-cy="remover-cor"
                      className="admin-form-color-remove-btn"
                      onClick={() => removerCor(cor.id)}
                      aria-label={`Remover cor ${cor.nome}`}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="admin-form-color-preview-wrap">
                    <div
                      className="admin-form-color-preview"
                      style={{ backgroundColor: cor.tonalidade }}
                    />
                  </div>

                  <div className="admin-form-color-field">
                    <span className="admin-form-label">Acrescimo</span>
                    <div className="admin-form-color-acrescimo">
                      <span>R$</span>
                      <input
                        data-cy={`acrescimo-cor-${cor.id}`}
                        type="number"
                        step="0.01"
                        placeholder="+0,00"
                        value={cor.acrescimo}
                        onChange={(e) => atualizarCorAcrescimo(cor.id, e.target.value)}
                      />
                    </div>
                  </div>

                  {cor.fotos?.length > 0 && (
                    <div className="admin-foto-previews">
                      {cor.fotos.map((foto, index) => (
                        <div key={index} className="admin-foto-preview-item">
                          <img
                            src={obterPreviewFoto(foto)}
                            alt={`Foto da cor ${cor.nome} ${index + 1}`}
                            className="admin-foto-preview-img"
                          />
                          <button
                            data-cy={`remover-foto-cor-${cor.id}-${index}`}
                            onClick={() => removerCorFoto(cor.id, index)}
                            className="admin-foto-preview-remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <label className="admin-form-color-upload-btn" htmlFor={`cor-fotos-${cor.id}`}>
                    <Upload size={16} />
                    Adicionar fotos
                  </label>
                  <input
                    data-cy={`upload-foto-cor-${cor.id}`}
                    id={`cor-fotos-${cor.id}`}
                    type="file"
                    multiple
                    className="admin-form-color-file-input"
                    onChange={(e) => handleCorFotosChange(cor.id, e)}
                    accept="image/*"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="admin-color-new-section">
          <div className="admin-color-new-header">
            <h4>Adicionar nova cor</h4>
          </div>

          <div className="admin-form-row admin-color-new-form">
            <div className="admin-form-group">
              <label className="admin-form-label">Nome da cor</label>
              <input
                type="text"
                className="admin-form-input"
                data-cy="nova-cor-nome"
                placeholder="Ex.: Azul Lunar"
                value={novaCor.nome}
                onChange={(e) => setNovaCor({ ...novaCor, nome: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Tonalidade</label>
              <input
                type="color"
                className="admin-form-color-input"
                data-cy="nova-cor-tonalidade"
                value={novaCor.tonalidade}
                onChange={(e) => setNovaCor({ ...novaCor, tonalidade: e.target.value })}
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Acrescimo</label>
              <div className="admin-form-input-prefix">
                <span>+</span>
                <input
                  type="number"
                  placeholder="0,00"
                  step="0.01"
                  data-cy="nova-cor-acrescimo"
                  value={novaCor.acrescimo}
                  onChange={(e) => setNovaCor({ ...novaCor, acrescimo: e.target.value })}
                />
              </div>
            </div>

            <button data-cy="adicionar-cor" className="admin-form-btn-add" onClick={adicionarCor}>
              <Plus size={18} />
              Adicionar cor
            </button>
          </div>
        </div>
      </div>

      <div className="admin-form-actions admin-form-actions--floating">
        <button data-cy="cancelar-produto" className="admin-form-btn-secondary" onClick={() => navigate("/admin/produtos")}>
          Cancelar
        </button>
        <button data-cy="salvar-produto" className="admin-form-btn-primary" onClick={salvarProdutoComFotos}>
          {carregandoEdicao ? "Carregando..." : produtoEdicaoId ? "Atualizar Produto" : "Salvar Produto"}
        </button>
      </div>
    </div >
  );
}

export default AdminProdutoCadastro;
