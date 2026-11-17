import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useNotification } from "../../components/notification";
import { assetUrl } from "../../utils/api";
import { apiFetch, getAuthHeaders } from "./admin-api";
import "../../css/admin-vitrine.css";

// Banners da página inicial (foto grande de campanha). Com mais de um no ar, a loja mostra um carrossel.
const VAZIO = {
  sobretitulo: "",
  titulo: "",
  subtitulo: "",
  texto_botao: "",
  link: "/catalogo",
  alinhamento: "esquerda",
  foco: "centro",
  ordem: 0,
  ativo: true,
  inicio: "",
  fim: "",
};

const LINKS_PRONTOS = [
  { valor: "/catalogo", rotulo: "Coleção (todas as peças)" },
  { valor: "/duvidas", rotulo: "Perguntas frequentes" },
  { valor: "/sobre", rotulo: "Sobre a Agnus" },
];

// datetime-local (hora de Brasília no navegador) <-> ISO com fuso, para o servidor não errar a hora.
const paraCampo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const paraIso = (campo) => (campo ? new Date(campo).toISOString() : "");

const formatarData = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

function situacao(b) {
  const agora = Date.now();
  if (!b.ativo) return { rotulo: "Desativado", classe: "off" };
  if (b.inicio && new Date(b.inicio).getTime() > agora) return { rotulo: "Agendado", classe: "agendado" };
  if (b.fim && new Date(b.fim).getTime() <= agora) return { rotulo: "Encerrado", classe: "off" };
  return { rotulo: "No ar", classe: "no-ar" };
}

const MAX_MB = 8;

// Foto do bloco de cada categoria em "Compre por categoria" (home). Sem foto escolhida, usa a da peça mais vendida.
function FotosDasCategorias({ notify }) {
  const [lista, setLista] = useState([]);
  const [enviando, setEnviando] = useState(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    apiFetch(`/vitrine/categorias?v=${versao}`)
      .then((r) => r.json())
      .then((j) => setLista(Array.isArray(j.data) ? j.data : []))
      .catch(() => setLista([]));
  }, [versao]);

  async function enviar(c, arquivo, remover = false) {
    if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) {
      notify.error(`A foto tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. Use até ${MAX_MB} MB.`);
      return;
    }
    setEnviando(c.id_categoria);
    try {
      const dados = new FormData();
      if (arquivo) dados.append("imagem", arquivo);
      if (remover) dados.append("remover", "true");
      const r = await apiFetch(`/vitrine/categorias/${c.id_categoria}/foto`, { method: "PUT", headers: getAuthHeaders({ json: false }), body: dados });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        notify.error(j?.message || "Não foi possível trocar a foto.");
        return;
      }
      notify.success(remover ? `"${c.nome}" voltou a usar a foto da peça mais vendida.` : `Foto de "${c.nome}" trocada.`);
      setVersao((n) => n + 1);
    } finally {
      setEnviando(null);
    }
  }

  if (!lista.length) return null;

  return (
    <section className="admin-vitrine-categorias" data-cy="fotos-categorias">
      <h2>Fotos das categorias</h2>
      <p className="admin-vitrine-ajuda">Blocos de “Compre por categoria” na página inicial. Use fotos verticais (ideal 1200 × 1600 px).</p>
      <ul>
        {lista.map((c) => (
          <li key={c.id_categoria} data-cy="foto-categoria">
            <div className="admin-vitrine-categoria-foto">
              {c.imagem_url ? <img src={assetUrl(c.imagem_url)} alt="" /> : <span>Sem foto</span>}
              <strong>{c.nome}</strong>
            </div>
            <small>{c.foto_escolhida ? "Foto escolhida pela equipe" : "Automática (peça mais vendida)"}</small>
            <label className="admin-form-btn-secondary admin-vitrine-trocar">
              {enviando === c.id_categoria ? "Enviando…" : "Trocar foto"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={enviando === c.id_categoria}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0];
                  e.target.value = "";
                  if (arquivo) enviar(c, arquivo);
                }}
              />
            </label>
            {c.foto_escolhida && (
              <button type="button" className="admin-vitrine-link" onClick={() => enviar(c, null, true)}>
                Usar a automática
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminVitrineBanners() {
  const notify = useNotification();
  const [banners, setBanners] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(null); // null = fechado
  const [editandoId, setEditandoId] = useState(null);
  const [imagem, setImagem] = useState(null);
  const [imagemMobile, setImagemMobile] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [recarregar, setRecarregar] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    apiFetch("/vitrine/banners/todos", { headers: getAuthHeaders() })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!ativo) return;
        if (!r.ok) notify.error(j?.message || "Não foi possível carregar os banners.");
        setBanners(Array.isArray(j.data) ? j.data : []);
      })
      .catch(() => ativo && notify.error("Erro ao conectar no servidor."))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
    // notify muda a cada render; recarregar é o gatilho.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recarregar]);

  useEffect(() => {
    apiFetch("/categories?limit=100", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((j) => setCategorias(Array.isArray(j) ? j : j.data ?? []))
      .catch(() => setCategorias([]));
  }, []);

  const previa = useMemo(() => {
    if (imagem) return URL.createObjectURL(imagem);
    const atual = banners.find((b) => b.id_banner === editandoId);
    return atual ? assetUrl(atual.imagem_url) : null;
  }, [imagem, editandoId, banners]);

  useEffect(() => () => previa?.startsWith("blob:") && URL.revokeObjectURL(previa), [previa]);

  function abrirNovo() {
    setForm({ ...VAZIO, ordem: banners.length });
    setEditandoId(null);
    setImagem(null);
    setImagemMobile(null);
  }

  function abrirEdicao(b) {
    setForm({
      sobretitulo: b.sobretitulo ?? "",
      titulo: b.titulo,
      subtitulo: b.subtitulo ?? "",
      texto_botao: b.texto_botao ?? "",
      link: b.link ?? "",
      alinhamento: b.alinhamento,
      foco: b.foco,
      ordem: b.ordem,
      ativo: b.ativo,
      inicio: paraCampo(b.inicio),
      fim: paraCampo(b.fim),
    });
    setEditandoId(b.id_banner);
    setImagem(null);
    setImagemMobile(null);
  }

  const campo = (nome) => (e) => {
    const valor = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [nome]: valor }));
  };

  function escolherArquivo(setter) {
    return (e) => {
      const arquivo = e.target.files?.[0] ?? null;
      if (arquivo && arquivo.size > MAX_MB * 1024 * 1024) {
        notify.error(`A foto tem ${(arquivo.size / 1024 / 1024).toFixed(1)} MB. Use até ${MAX_MB} MB (exporte em JPG ou WEBP).`);
        e.target.value = "";
        return;
      }
      setter(arquivo);
    };
  }

  async function salvar(e) {
    e.preventDefault();
    if (!editandoId && !imagem) {
      notify.error("Escolha a foto do banner.");
      return;
    }
    setSalvando(true);
    try {
      const dados = new FormData();
      Object.entries({ ...form, inicio: paraIso(form.inicio), fim: paraIso(form.fim) }).forEach(([k, v]) => dados.append(k, String(v ?? "")));
      if (imagem) dados.append("imagem", imagem);
      if (imagemMobile) dados.append("imagem_mobile", imagemMobile);

      const r = await apiFetch(editandoId ? `/vitrine/banners/${editandoId}` : "/vitrine/banners", {
        method: editandoId ? "PUT" : "POST",
        headers: getAuthHeaders({ json: false }),
        body: dados,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        notify.error(j?.message || "Não foi possível salvar o banner.");
        return;
      }
      notify.success(editandoId ? "Banner atualizado." : "Banner criado. Ele já aparece na página inicial.");
      setForm(null);
      setRecarregar((n) => n + 1);
    } catch {
      notify.error("Erro ao conectar no servidor.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(b) {
    if (!window.confirm(`Excluir o banner "${b.titulo}"? A foto também é apagada.`)) return;
    const r = await apiFetch(`/vitrine/banners/${b.id_banner}`, { method: "DELETE", headers: getAuthHeaders() });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      notify.error(j?.message || "Não foi possível excluir.");
      return;
    }
    notify.success("Banner excluído.");
    setRecarregar((n) => n + 1);
  }

  const noAr = banners.filter((b) => situacao(b).classe === "no-ar").length;

  return (
    <div className="admin-products-list admin-vitrine" data-cy="admin-vitrine">
      <div className="admin-categorias-header">
        <p className="admin-vitrine-ajuda">
          Fotos grandes de campanha na página inicial, de ponta a ponta da tela. Use fotos na horizontal (ideal 2400 × 1200 px).
          {noAr > 1 && ` ${noAr} banners no ar: a loja mostra um carrossel.`}
        </p>
        <button type="button" className="admin-btn-novo" data-cy="novo-banner" onClick={abrirNovo}>
          <Plus size={18} /> Novo banner
        </button>
      </div>

      {carregando ? (
        <p className="admin-products-empty">Carregando…</p>
      ) : banners.length === 0 ? (
        <div className="admin-products-empty admin-vitrine-vazio">
          <ImagePlus size={36} strokeWidth={1.25} aria-hidden="true" />
          <p>Nenhum banner ainda. Crie o primeiro com uma foto da coleção.</p>
        </div>
      ) : (
        <ul className="admin-vitrine-lista" data-cy="lista-banners">
          {banners.map((b) => {
            const s = situacao(b);
            return (
              <li key={b.id_banner} className="admin-vitrine-item" data-cy="banner-item">
                <img src={assetUrl(b.imagem_url)} alt="" />
                <div className="admin-vitrine-item-texto">
                  <span className={`admin-vitrine-situacao admin-vitrine-situacao--${s.classe}`}>{s.rotulo}</span>
                  <strong>{b.titulo}</strong>
                  <small>
                    Ordem {b.ordem}
                    {b.link ? ` · leva para ${b.link}` : ""}
                    {b.inicio ? ` · de ${formatarData(b.inicio)}` : ""}
                    {b.fim ? ` até ${formatarData(b.fim)}` : ""}
                  </small>
                </div>
                <div className="admin-products-acoes">
                  <button type="button" className="admin-products-btn" aria-label={`Editar ${b.titulo}`} data-cy="editar-banner" onClick={() => abrirEdicao(b)}>
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="admin-products-btn" aria-label={`Excluir ${b.titulo}`} data-cy="excluir-banner" onClick={() => excluir(b)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FotosDasCategorias notify={notify} />

      {form && (
        <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="titulo-form-banner">
          <form className="admin-modal-content admin-vitrine-form" onSubmit={salvar} data-cy="form-banner">
            <h2 id="titulo-form-banner">{editandoId ? "Editar banner" : "Novo banner"}</h2>

            <div className={`admin-vitrine-previa admin-vitrine-previa--${form.alinhamento}`} aria-label="Prévia">
              {previa ? (
                <img src={previa} alt="" style={{ objectPosition: `center ${form.foco === "topo" ? "20%" : form.foco === "base" ? "80%" : "50%"}` }} />
              ) : (
                <span className="admin-vitrine-previa-vazia">A prévia aparece quando você escolher a foto</span>
              )}
              <div className="admin-vitrine-previa-texto">
                {form.sobretitulo && <small>{form.sobretitulo}</small>}
                <strong>{form.titulo || "Título do banner"}</strong>
                {form.subtitulo && <p>{form.subtitulo}</p>}
                {form.texto_botao && <span>{form.texto_botao}</span>}
              </div>
            </div>

            <div className="admin-vitrine-campos">
              <label className="admin-form-group">
                <span className="admin-form-label">Foto {editandoId ? "(deixe vazio para manter)" : "*"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="admin-form-input" data-cy="banner-imagem" onChange={escolherArquivo(setImagem)} />
              </label>
              <label className="admin-form-group">
                <span className="admin-form-label">Foto para celular (opcional, vertical)</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="admin-form-input" onChange={escolherArquivo(setImagemMobile)} />
              </label>

              <label className="admin-form-group">
                <span className="admin-form-label">Texto pequeno acima do título</span>
                <input className="admin-form-input" maxLength={40} placeholder="Ex.: Black Friday" value={form.sobretitulo} onChange={campo("sobretitulo")} />
              </label>
              <label className="admin-form-group">
                <span className="admin-form-label">Título *</span>
                <input className="admin-form-input" maxLength={80} required data-cy="banner-titulo" value={form.titulo} onChange={campo("titulo")} />
              </label>
              <label className="admin-form-group admin-vitrine-largo">
                <span className="admin-form-label">Texto</span>
                <input className="admin-form-input" maxLength={180} value={form.subtitulo} onChange={campo("subtitulo")} />
              </label>

              <label className="admin-form-group">
                <span className="admin-form-label">Texto do botão</span>
                <input className="admin-form-input" maxLength={40} placeholder="Ex.: Ver a coleção" data-cy="banner-botao" value={form.texto_botao} onChange={campo("texto_botao")} />
              </label>
              <label className="admin-form-group">
                <span className="admin-form-label">O botão leva para</span>
                <select
                  className="admin-form-input"
                  data-cy="banner-link"
                  value={[...LINKS_PRONTOS.map((l) => l.valor), ...categorias.map((c) => `/catalogo?categoria=${c.id_categoria}`)].includes(form.link) ? form.link : "outro"}
                  onChange={(e) => setForm((f) => ({ ...f, link: e.target.value === "outro" ? "/" : e.target.value }))}
                >
                  {LINKS_PRONTOS.map((l) => <option key={l.valor} value={l.valor}>{l.rotulo}</option>)}
                  {categorias.map((c) => <option key={c.id_categoria} value={`/catalogo?categoria=${c.id_categoria}`}>Categoria: {c.nome}</option>)}
                  <option value="outro">Outra página da loja…</option>
                </select>
              </label>
              {![...LINKS_PRONTOS.map((l) => l.valor), ...categorias.map((c) => `/catalogo?categoria=${c.id_categoria}`)].includes(form.link) && (
                <label className="admin-form-group admin-vitrine-largo">
                  <span className="admin-form-label">Endereço da página (ex.: /produto/4)</span>
                  <input className="admin-form-input" value={form.link} onChange={campo("link")} />
                </label>
              )}

              <label className="admin-form-group">
                <span className="admin-form-label">Posição do texto</span>
                <select className="admin-form-input" value={form.alinhamento} onChange={campo("alinhamento")}>
                  <option value="esquerda">Esquerda</option>
                  <option value="centro">Centro</option>
                  <option value="direita">Direita</option>
                </select>
              </label>
              <label className="admin-form-group">
                <span className="admin-form-label">Parte da foto em destaque</span>
                <select className="admin-form-input" value={form.foco} onChange={campo("foco")}>
                  <option value="topo">Topo</option>
                  <option value="centro">Centro</option>
                  <option value="base">Base</option>
                </select>
              </label>

              <label className="admin-form-group">
                <span className="admin-form-label">Começa em (opcional)</span>
                <input type="datetime-local" className="admin-form-input" value={form.inicio} onChange={campo("inicio")} />
              </label>
              <label className="admin-form-group">
                <span className="admin-form-label">Termina em (opcional)</span>
                <input type="datetime-local" className="admin-form-input" value={form.fim} onChange={campo("fim")} />
              </label>

              <label className="admin-form-group">
                <span className="admin-form-label">Ordem</span>
                <input type="number" min={0} max={999} className="admin-form-input" value={form.ordem} onChange={campo("ordem")} />
              </label>
              <label className="admin-vitrine-check">
                <input type="checkbox" checked={form.ativo} onChange={campo("ativo")} /> Ativo
              </label>
            </div>

            <div className="admin-form-actions">
              <button type="button" className="admin-form-btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="admin-form-btn-primary" data-cy="salvar-banner" disabled={salvando}>
                {salvando ? "Salvando…" : "Salvar banner"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
