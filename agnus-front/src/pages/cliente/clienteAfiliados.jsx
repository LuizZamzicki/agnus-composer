import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, ExternalLink, KeyRound, Link2 } from "lucide-react";
import { apiUrl, authHeaders } from "../../utils/api";
import { formatarReal } from "../../utils/sacola";
import { EsqueletoLinhas } from "../../components/esqueleto";
import "../../css/cliente/afiliados.css";

const STATUS_COMISSAO = {
    aguardando_pagamento: "Aguardando o pagamento do pedido",
    pendente: "Pendente",
    aprovada: "Aprovada (a receber)",
    paga: "Paga",
    cancelada: "Cancelada",
};

const formatarData = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "—");
const hojeMenos = (dias) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

class ErroApi extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

async function chamar(caminho, opcoes = {}) {
    const res = await fetch(apiUrl(caminho), {
        ...opcoes,
        headers: authHeaders({ "Content-Type": "application/json", ...(opcoes.headers || {}) }),
    });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new ErroApi(res.status, dados?.message || "Não foi possível concluir agora. Tente de novo.");
    return dados;
}

function BotaoCopiar({ texto, rotulo = "Copiar", dataCy }) {
    const [copiado, setCopiado] = useState(false);

    async function copiar() {
        try {
            await navigator.clipboard.writeText(texto);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            window.prompt("Copie o texto:", texto);
        }
    }

    return (
        <button type="button" className="afi-copiar" onClick={copiar} data-cy={dataCy} aria-label={`${rotulo}: ${texto}`}>
            {copiado ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copiado ? "Copiado" : rotulo}
        </button>
    );
}

// ---------------- Inscrição ----------------
function Inscricao({ onInscrito }) {
    const [form, setForm] = useState({ nome_publico: "", canal: "", chave_pix: "", aceite_termos: false });
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState("");

    async function enviar(e) {
        e.preventDefault();
        setEnviando(true);
        setErro("");
        try {
            await chamar("afiliados/inscricao", { method: "POST", body: JSON.stringify(form) });
            await onInscrito();
        } catch (err) {
            setErro(err.message);
        } finally {
            setEnviando(false);
        }
    }

    const campo = (nome) => ({ value: form[nome], onChange: (e) => setForm({ ...form, [nome]: e.target.value }) });

    return (
        <div className="afi" data-cy="afiliados-inscricao">
            <p className="afi-intro">
                Divulgue as peças da Agnus com o seu link e ganhe comissão em cada compra feita por ele.
            </p>

            <ol className="afi-passos">
                <li><strong>Inscreva-se</strong> e aguarde a aprovação da equipe.</li>
                <li><strong>Gere seus links</strong> de qualquer produto e divulgue onde quiser.</li>
                <li><strong>Receba por PIX</strong> a comissão das compras feitas em até 7 dias depois do clique.</li>
            </ol>

            <form className="afi-form" onSubmit={enviar}>
                <label>
                    Nome público
                    <input data-cy="afi-nome" required maxLength={80} placeholder="Como você se apresenta (ex.: @seuperfil)" {...campo("nome_publico")} />
                </label>
                <label>
                    Onde você vai divulgar <small>(opcional)</small>
                    <input data-cy="afi-canal" maxLength={255} placeholder="Ex.: instagram.com/seuperfil" {...campo("canal")} />
                </label>
                <label>
                    Chave PIX para receber <small>(pode preencher depois)</small>
                    <input data-cy="afi-pix" maxLength={120} placeholder="CPF, e-mail, telefone ou chave aleatória" {...campo("chave_pix")} />
                </label>
                <label className="afi-aceite">
                    <input
                        type="checkbox"
                        data-cy="afi-termos"
                        checked={form.aceite_termos}
                        onChange={(e) => setForm({ ...form, aceite_termos: e.target.checked })}
                    />
                    <span>
                        Li e aceito os <Link to="/afiliados/termos" target="_blank">termos do programa de afiliados</Link>.
                    </span>
                </label>

                {erro && <p className="fin-erro" role="alert">{erro}</p>}

                <button type="submit" className="btn-agnus" data-cy="afi-inscrever" disabled={enviando || !form.aceite_termos || form.nome_publico.trim().length < 2}>
                    {enviando ? "Enviando…" : "Quero ser afiliado"}
                </button>
            </form>
        </div>
    );
}

// ---------------- Painel do afiliado aprovado ----------------
function Resumo({ resumo }) {
    const c = resumo.comissao;
    const cartoes = [
        { rotulo: "Cliques (30 dias)", valor: resumo.cliques_30_dias, dinheiro: false },
        { rotulo: "Pendente", valor: c.pendente.comissao + c.aguardando_pagamento_do_pedido.comissao, dica: "Libera 7 dias após a entrega" },
        { rotulo: "A receber", valor: c.a_receber.comissao, destaque: true, dica: "Aprovado, entra no próximo pagamento" },
        { rotulo: "Já recebido", valor: c.recebida.comissao },
    ];

    return (
        <div className="afi-cartoes" data-cy="afi-resumo">
            {cartoes.map((cartao) => (
                <div key={cartao.rotulo} className={`afi-cartao ${cartao.destaque ? "destaque" : ""}`}>
                    <span>{cartao.rotulo}</span>
                    <strong>{cartao.dinheiro === false ? cartao.valor : formatarReal(cartao.valor)}</strong>
                    {cartao.dica && <small>{cartao.dica}</small>}
                </div>
            ))}
        </div>
    );
}

function GerarLink() {
    const [url, setUrl] = useState("");
    const [subId, setSubId] = useState("");
    const [link, setLink] = useState(null);
    const [erro, setErro] = useState("");
    const [gerando, setGerando] = useState(false);

    async function gerar(e) {
        e.preventDefault();
        setErro("");
        setGerando(true);
        try {
            const subIds = subId.trim() ? [subId.trim()] : [];
            setLink(await chamar("afiliados/v1/links", { method: "POST", body: JSON.stringify({ url: url.trim() || "/", sub_ids: subIds }) }));
        } catch (err) {
            setErro(err.message);
            setLink(null);
        } finally {
            setGerando(false);
        }
    }

    return (
        <section className="afi-bloco" aria-labelledby="afi-gerar">
            <h3 id="afi-gerar"><Link2 size={18} aria-hidden="true" /> Gerar link</h3>
            <p className="afi-ajuda">Cole o endereço de qualquer página da loja (produto, catálogo ou a home).</p>
            <form className="afi-linha" onSubmit={gerar}>
                <input data-cy="afi-url" placeholder="Ex.: https://agnusfit.com/produto/12" value={url} onChange={(e) => setUrl(e.target.value)} />
                <input
                    data-cy="afi-subid"
                    className="afi-subid"
                    placeholder="Marcador (opcional)"
                    title="Use para saber de onde veio a venda: instagram, story, youtube…"
                    pattern="[A-Za-z0-9_\-]{1,50}"
                    value={subId}
                    onChange={(e) => setSubId(e.target.value)}
                />
                <button type="submit" className="btn-agnus" disabled={gerando} data-cy="afi-gerar">{gerando ? "Gerando…" : "Gerar"}</button>
            </form>
            {erro && <p className="fin-erro" role="alert">{erro}</p>}
            {link && (
                <div className="afi-resultado" data-cy="afi-link-gerado">
                    <code>{link.link_curto}</code>
                    <BotaoCopiar texto={link.link_curto} dataCy="afi-copiar-link" />
                </div>
            )}
        </section>
    );
}

function Ofertas() {
    const [dados, setDados] = useState(null);
    const [erro, setErro] = useState("");

    useEffect(() => {
        chamar("afiliados/v1/ofertas?ordenar=comissao_desc&limit=12").then(setDados).catch((e) => setErro(e.message));
    }, []);

    return (
        <section className="afi-bloco" aria-labelledby="afi-ofertas">
            <h3 id="afi-ofertas">Produtos para divulgar</h3>
            {erro && <p className="fin-erro">{erro}</p>}
            {!dados && !erro && <EsqueletoLinhas rotulo="Carregando produtos…" />}
            {dados && (
                <ul className="afi-ofertas" data-cy="afi-ofertas">
                    {dados.data.map((o) => (
                        <li key={o.id_produto}>
                            {o.imagem ? <img src={o.imagem} alt="" loading="lazy" /> : <span className="afi-sem-foto" aria-hidden="true" />}
                            <div>
                                <strong>{o.nome}</strong>
                                <small>
                                    {formatarReal(o.preco)} · comissão {o.taxa_comissao}% ≈ <b>{formatarReal(o.comissao_estimada)}</b>
                                </small>
                            </div>
                            {o.link_afiliado && <BotaoCopiar texto={o.link_afiliado} rotulo="Copiar link" />}
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function Vendas() {
    const [filtro, setFiltro] = useState({ dias: 30, status: "" });
    const [dados, setDados] = useState(null);
    const [erro, setErro] = useState("");

    useEffect(() => {
        const params = new URLSearchParams({ inicio: hojeMenos(filtro.dias), limit: "50" });
        if (filtro.status) params.set("status", filtro.status);
        setDados(null);
        chamar(`afiliados/v1/conversoes?${params}`).then(setDados).catch((e) => setErro(e.message));
    }, [filtro]);

    return (
        <section className="afi-bloco" aria-labelledby="afi-vendas">
            <h3 id="afi-vendas">Minhas vendas</h3>
            <div className="afi-filtros">
                <select value={filtro.dias} onChange={(e) => setFiltro({ ...filtro, dias: Number(e.target.value) })} aria-label="Período">
                    <option value={7}>Últimos 7 dias</option>
                    <option value={30}>Últimos 30 dias</option>
                    <option value={90}>Últimos 90 dias</option>
                </select>
                <select value={filtro.status} onChange={(e) => setFiltro({ ...filtro, status: e.target.value })} aria-label="Status">
                    <option value="">Todos os status</option>
                    {Object.entries(STATUS_COMISSAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
            </div>
            {erro && <p className="fin-erro">{erro}</p>}
            {!dados && !erro && <EsqueletoLinhas rotulo="Carregando vendas…" />}
            {dados && dados.data.length === 0 && <p className="afi-vazio">Nenhuma venda neste período ainda. Divulgue seus links!</p>}
            {dados && dados.data.length > 0 && (
                <div className="afi-tabela-rolagem">
                    <table className="afi-tabela" data-cy="afi-vendas">
                        <thead>
                            <tr><th>Data</th><th>Peças</th><th>Marcador</th><th>Valor</th><th>Comissão</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                            {dados.data.map((v) => (
                                <tr key={v.id_conversao}>
                                    <td>{formatarData(v.data_pedido)}</td>
                                    <td>{v.itens.map((i) => `${i.quantidade}× ${i.nome_produto || "Produto"}`).join(", ")}</td>
                                    <td>{v.link?.sub_ids?.join(", ") || "—"}</td>
                                    <td>{formatarReal(v.valor_comissionavel)}</td>
                                    <td><strong>{formatarReal(v.valor_comissao)}</strong></td>
                                    <td>
                                        <span className={`afi-status afi-status--${v.status}`}>{STATUS_COMISSAO[v.status]}</span>
                                        {v.status === "pendente" && v.liberada_em && <small> até {formatarData(v.liberada_em)}</small>}
                                        {v.motivo_cancelamento && <small> {v.motivo_cancelamento}</small>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function Pagamentos() {
    const [dados, setDados] = useState(null);

    useEffect(() => {
        chamar("afiliados/me/pagamentos").then(setDados).catch(() => setDados({ data: [] }));
    }, []);

    if (!dados || dados.data.length === 0) return null;

    return (
        <section className="afi-bloco" aria-labelledby="afi-pagamentos">
            <h3 id="afi-pagamentos">Pagamentos recebidos</h3>
            <ul className="afi-lista">
                {dados.data.map((p) => (
                    <li key={p.id_pagamento}>
                        <span>{formatarData(p.data_criacao)} · {p.quantidade_conversoes} venda(s)</span>
                        <strong>{formatarReal(p.valor)}</strong>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function MeusDados({ afiliado, onSalvo }) {
    const [form, setForm] = useState({ nome_publico: afiliado.nome_publico, canal: afiliado.canal || "", chave_pix: afiliado.chave_pix || "" });
    const [msg, setMsg] = useState("");
    const [salvando, setSalvando] = useState(false);

    async function salvar(e) {
        e.preventDefault();
        setSalvando(true);
        setMsg("");
        try {
            await chamar("afiliados/me", { method: "PATCH", body: JSON.stringify(form) });
            setMsg("Dados salvos.");
            await onSalvo();
        } catch (err) {
            setMsg(err.message);
        } finally {
            setSalvando(false);
        }
    }

    return (
        <section className="afi-bloco" aria-labelledby="afi-dados">
            <h3 id="afi-dados">Meus dados</h3>
            {!afiliado.chave_pix && <p className="afi-alerta">Cadastre sua chave PIX para receber as comissões.</p>}
            <form className="afi-form" onSubmit={salvar}>
                <label>Nome público<input maxLength={80} value={form.nome_publico} onChange={(e) => setForm({ ...form, nome_publico: e.target.value })} /></label>
                <label>Onde divulga<input maxLength={255} value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} /></label>
                <label>Chave PIX<input data-cy="afi-pix-editar" maxLength={120} value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} /></label>
                {msg && <p className="afi-ajuda" role="status">{msg}</p>}
                <button type="submit" className="btn-agnus-ghost" disabled={salvando}>{salvando ? "Salvando…" : "Salvar dados"}</button>
            </form>
        </section>
    );
}

function CredenciaisApi({ afiliado, onGerado }) {
    const [credencial, setCredencial] = useState(null);
    const [erro, setErro] = useState("");

    async function gerar() {
        if (afiliado.tem_credencial_api && !window.confirm("Gerar um novo segredo invalida o atual. Suas integrações vão parar até você trocar. Continuar?")) return;
        setErro("");
        try {
            setCredencial(await chamar("afiliados/me/credenciais", { method: "POST" }));
            await onGerado();
        } catch (err) {
            setErro(err.message);
        }
    }

    return (
        <section className="afi-bloco" aria-labelledby="afi-api">
            <h3 id="afi-api"><KeyRound size={18} aria-hidden="true" /> API para integrações</h3>
            <p className="afi-ajuda">
                Para quem tem site ou automação: a mesma API da Shopee Afiliados (ofertas, links e relatórios), com AppID e assinatura SHA256.{" "}
                <a href="/api/docs/" target="_blank" rel="noreferrer">Ver documentação <ExternalLink size={13} aria-hidden="true" /></a>
            </p>
            {afiliado.app_id && <p className="afi-ajuda">AppID: <code>{afiliado.app_id}</code></p>}
            {credencial && (
                <div className="afi-segredo" data-cy="afi-segredo" role="alert">
                    <p><strong>Guarde agora:</strong> o segredo não aparece de novo.</p>
                    <div className="afi-resultado"><code>{credencial.segredo}</code><BotaoCopiar texto={credencial.segredo} /></div>
                </div>
            )}
            {erro && <p className="fin-erro">{erro}</p>}
            <button type="button" className="btn-agnus-ghost" onClick={gerar} data-cy="afi-gerar-credencial">
                {afiliado.tem_credencial_api ? "Gerar novo segredo" : "Gerar credenciais"}
            </button>
        </section>
    );
}

// ---------------- Página ----------------
export default function ClienteAfiliados() {
    const [estado, setEstado] = useState({ carregando: true, afiliado: null, erro: "" });

    const carregar = useCallback(async () => {
        try {
            const afiliado = await chamar("afiliados/me");
            setEstado({ carregando: false, afiliado, erro: "" });
        } catch (err) {
            setEstado({ carregando: false, afiliado: null, erro: err.status === 404 ? "" : err.message });
        }
    }, []);

    useEffect(() => {
        carregar();
    }, [carregar]);

    const { carregando, afiliado, erro } = estado;

    return (
        <>
            <h2 data-cy="titulo-afiliados">Programa de afiliados</h2>
            {carregando && <EsqueletoLinhas rotulo="Carregando…" />}
            {!carregando && erro && <p className="fin-erro">{erro}</p>}
            {!carregando && !erro && !afiliado && <Inscricao onInscrito={carregar} />}

            {afiliado && afiliado.status === "pendente" && (
                <div className="afi-aviso" data-cy="afi-pendente">
                    <strong>Inscrição recebida!</strong> Nossa equipe está analisando seu cadastro. Você recebe acesso ao painel assim que for aprovado.
                </div>
            )}
            {afiliado && (afiliado.status === "suspenso" || afiliado.status === "recusado") && (
                <div className="afi-aviso erro" data-cy="afi-inativo">
                    Seu cadastro de afiliado está {afiliado.status}. Seus links não geram comissão. Dúvidas: contato@agnusfit.com.
                </div>
            )}

            {afiliado && afiliado.status === "ativo" && (
                <div className="afi" data-cy="afi-painel">
                    <p className="afi-intro">
                        Olá, <strong>{afiliado.nome_publico}</strong>! Comissão {afiliado.taxa_personalizada != null ? `combinada de ${afiliado.taxa_personalizada}%` : "conforme o produto"}.
                        A compra conta para você por 7 dias depois do clique.
                    </p>
                    <Resumo resumo={afiliado.resumo} />
                    <GerarLink />
                    <Ofertas />
                    <Vendas />
                    <Pagamentos />
                    <MeusDados afiliado={afiliado} onSalvo={carregar} />
                    <CredenciaisApi afiliado={afiliado} onGerado={carregar} />
                </div>
            )}
        </>
    );
}
