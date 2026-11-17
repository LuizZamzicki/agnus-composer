import { useState } from "react";
import { Camera, RotateCcw, X } from "lucide-react";
import { apiUrl, assetUrl, authHeaders } from "../utils/api";
import { formatarReal } from "../utils/sacola";
import FotoProtegida, { reduzirImagem } from "./fotoProtegida";
import "../css/devolucao.css";

const ETAPAS = [
    { status: "solicitada", rotulo: "Pedido" },
    { status: "aprovada", rotulo: "Aprovada" },
    { status: "recebida", rotulo: "Peça recebida" },
    { status: "reembolsada", rotulo: "Reembolso" },
];

const MAX_FOTOS = 3;

const formatarData = (valor) => (valor ? new Date(valor).toLocaleDateString("pt-BR") : "");

async function chamar(caminho, opcoes = {}) {
    const res = await fetch(apiUrl(caminho), {
        ...opcoes,
        headers: authHeaders({ "Content-Type": "application/json", ...(opcoes.headers || {}) }),
    });
    const dados = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(dados?.message || "Não foi possível concluir agora. Tente de novo.");
    return dados;
}

// Linha do tempo de uma devolução já pedida: etapas, resposta da loja, código de postagem e valor.
function AcompanharDevolucao({ devolucao, onCancelar, cancelando, onAdicionarFoto, enviandoFoto }) {
    const encerrada = devolucao.status === "recusada" || devolucao.status === "cancelada";
    const atual = ETAPAS.findIndex((e) => e.status === devolucao.status);

    return (
        <article className="devolucao" data-cy="devolucao" aria-label={`Devolução ${devolucao.id_devolucao}`}>
            <header className="devolucao-topo">
                <strong>Devolução #{devolucao.id_devolucao}</strong>
                <span className={`devolucao-status devolucao-status--${devolucao.status}`} data-cy="devolucao-status">
                    {devolucao.status_rotulo}
                </span>
            </header>

            {!encerrada && (
                <ol className="devolucao-etapas" aria-label="Etapas da devolução">
                    {ETAPAS.map((etapa, i) => (
                        <li key={etapa.status} className={i <= atual ? "feita" : ""} aria-current={i === atual ? "step" : undefined}>
                            <span aria-hidden="true">{i <= atual ? "✓" : i + 1}</span>
                            {etapa.rotulo}
                        </li>
                    ))}
                </ol>
            )}

            <ul className="devolucao-itens">
                {devolucao.itens.map((item) => (
                    <li key={item.id_pedido_item}>
                        {item.quantidade}× {item.nome_produto}
                        {item.tamanho ? ` · ${item.tamanho}` : ""}
                        {item.cor ? ` · ${item.cor}` : ""}
                    </li>
                ))}
            </ul>

            <dl className="devolucao-dados">
                <div><dt>Motivo</dt><dd>{devolucao.motivo_rotulo}</dd></div>
                <div><dt>Pedida em</dt><dd>{formatarData(devolucao.data_solicitacao)}</dd></div>
                <div><dt>Reembolso</dt><dd>{formatarReal(devolucao.valor_reembolso)}</dd></div>
                {devolucao.codigo_postagem && (
                    <div><dt>Código de postagem</dt><dd className="devolucao-codigo" data-cy="devolucao-codigo">{devolucao.codigo_postagem}</dd></div>
                )}
            </dl>

            {(devolucao.fotos?.length > 0 || devolucao.status === "solicitada") && (
                <div className="devolucao-fotos" data-cy="devolucao-fotos">
                    {(devolucao.fotos || []).map((foto) => (
                        <FotoProtegida key={foto.id_devolucao_foto} url={foto.url} alt="Foto anexada à devolução" className="devolucao-foto-mini" />
                    ))}
                    {devolucao.status === "solicitada" && (devolucao.fotos?.length || 0) < MAX_FOTOS && (
                        <label className="devolucao-foto-add" title="Anexar foto">
                            <input
                                type="file"
                                accept="image/*"
                                data-cy="devolucao-adicionar-foto"
                                disabled={enviandoFoto}
                                onChange={(e) => {
                                    const arquivo = e.target.files?.[0];
                                    e.target.value = "";
                                    if (arquivo) onAdicionarFoto(devolucao, arquivo);
                                }}
                            />
                            <Camera size={18} aria-hidden="true" />
                            <span>{enviandoFoto ? "Enviando…" : "Foto"}</span>
                        </label>
                    )}
                </div>
            )}

            {devolucao.resposta_loja && (
                <p className={`devolucao-resposta ${devolucao.status === "recusada" ? "recusa" : ""}`} data-cy="devolucao-resposta">
                    <strong>{devolucao.status === "recusada" ? "Motivo da recusa: " : "Como enviar: "}</strong>
                    {devolucao.resposta_loja}
                </p>
            )}

            {devolucao.status === "reembolsada" && (
                <p className="devolucao-aviso">
                    Reembolso feito em {formatarData(devolucao.data_reembolso)}. No PIX o valor volta na hora; no cartão, aparece em até duas faturas.
                </p>
            )}

            {devolucao.status === "solicitada" && (
                <button type="button" className="pedido-ver-pecas" data-cy="cancelar-devolucao" disabled={cancelando} onClick={() => onCancelar(devolucao)}>
                    {cancelando ? "Cancelando…" : "Cancelar devolução"}
                </button>
            )}
        </article>
    );
}

// Formulário: peças e quantidades, motivo (com o prazo de cada um) e o que aconteceu.
function FormularioDevolucao({ opcoes, onEnviar, onFechar, enviando, erro }) {
    const [quantidades, setQuantidades] = useState({});
    const [motivo, setMotivo] = useState(opcoes.motivos.find((m) => m.disponivel)?.valor || "");
    const [descricao, setDescricao] = useState("");
    const [fotos, setFotos] = useState([]);
    const [erroFoto, setErroFoto] = useState("");

    async function escolherFotos(lista) {
        setErroFoto("");
        const livres = MAX_FOTOS - fotos.length;
        const escolhidas = Array.from(lista).slice(0, livres);
        if (lista.length > livres) setErroFoto(`Até ${MAX_FOTOS} fotos por devolução.`);

        for (const arquivo of escolhidas) {
            try {
                const dataUrl = await reduzirImagem(arquivo);
                setFotos((atual) => (atual.length < MAX_FOTOS ? [...atual, dataUrl] : atual));
            } catch (err) {
                setErroFoto(err.message);
            }
        }
    }

    const exigeDescricao = motivo === "defeito" || motivo === "produto_errado";
    const escolhidos = Object.entries(quantidades).filter(([, q]) => q > 0);
    const valor = escolhidos.reduce((total, [id, q]) => {
        const item = opcoes.itens.find((i) => String(i.id_pedido_item) === id);
        return total + (item ? item.preco_unitario * q : 0);
    }, 0);
    const podeEnviar = escolhidos.length > 0 && motivo && (!exigeDescricao || descricao.trim().length >= 10) && !enviando;

    function alternar(item, marcado) {
        setQuantidades((atual) => ({ ...atual, [item.id_pedido_item]: marcado ? Math.min(1, item.quantidade_devolvivel) || 1 : 0 }));
    }

    function enviar(e) {
        e.preventDefault();
        if (!podeEnviar) return;
        onEnviar({
            motivo,
            descricao: descricao.trim(),
            itens: escolhidos.map(([id, quantidade]) => ({ id_pedido_item: Number(id), quantidade })),
        }, fotos);
    }

    return (
        <form className="devolucao-form" onSubmit={enviar} data-cy="form-devolucao">
            <fieldset>
                <legend>Quais peças você quer devolver?</legend>
                {opcoes.itens.map((item) => {
                    const marcado = (quantidades[item.id_pedido_item] || 0) > 0;
                    const indisponivel = item.quantidade_devolvivel === 0;
                    return (
                        <div key={item.id_pedido_item} className={`devolucao-item ${indisponivel ? "indisponivel" : ""}`}>
                            <label>
                                <input
                                    type="checkbox"
                                    data-cy="devolucao-item"
                                    checked={marcado}
                                    disabled={indisponivel}
                                    onChange={(e) => alternar(item, e.target.checked)}
                                />
                                {item.foto_produto
                                    ? <img src={assetUrl(item.foto_produto)} alt="" className="devolucao-foto" />
                                    : <span className="devolucao-foto" aria-hidden="true" />}
                                <span>
                                    <strong>{item.nome_produto}</strong>
                                    <small>
                                        {[item.tamanho, item.cor].filter(Boolean).join(" · ")}
                                        {" · "}{formatarReal(item.preco_unitario)} cada
                                        {indisponivel ? " · já devolvida" : ""}
                                    </small>
                                </span>
                            </label>
                            {marcado && item.quantidade_devolvivel > 1 && (
                                <label className="devolucao-qtd">
                                    Quantidade
                                    <select
                                        value={quantidades[item.id_pedido_item]}
                                        onChange={(e) => setQuantidades((a) => ({ ...a, [item.id_pedido_item]: Number(e.target.value) }))}
                                    >
                                        {Array.from({ length: item.quantidade_devolvivel }, (_, i) => i + 1).map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>
                    );
                })}
            </fieldset>

            <fieldset>
                <legend>Motivo</legend>
                {opcoes.motivos.map((m) => (
                    <label key={m.valor} className={`devolucao-motivo ${m.disponivel ? "" : "indisponivel"}`}>
                        <input
                            type="radio"
                            name="motivo"
                            value={m.valor}
                            data-cy={`motivo-${m.valor}`}
                            checked={motivo === m.valor}
                            disabled={!m.disponivel}
                            onChange={() => setMotivo(m.valor)}
                        />
                        <span>
                            {m.rotulo}
                            <small>
                                {m.disponivel ? `até ${formatarData(m.disponivel_ate)}` : `prazo de ${m.prazo_dias} dias encerrado`}
                            </small>
                        </span>
                    </label>
                ))}
            </fieldset>

            <label className="devolucao-descricao">
                {exigeDescricao ? "Conte o que aconteceu (obrigatório)" : "Quer contar mais alguma coisa? (opcional)"}
                <textarea
                    data-cy="devolucao-descricao"
                    rows={3}
                    maxLength={1000}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    placeholder={exigeDescricao ? "Ex.: a costura da manga abriu na primeira lavagem." : ""}
                />
            </label>

            <div className="devolucao-descricao">
                <span>
                    Fotos da peça <small>({exigeDescricao ? "recomendado: mostre o problema" : "opcional"}, até {MAX_FOTOS})</small>
                </span>
                <div className="devolucao-fotos">
                    {fotos.map((foto, i) => (
                        <span key={foto.slice(-40)} className="devolucao-foto-previa">
                            <img src={foto} alt={`Foto ${i + 1}`} className="devolucao-foto-mini" />
                            <button type="button" aria-label={`Remover foto ${i + 1}`} onClick={() => setFotos((a) => a.filter((_, j) => j !== i))}>
                                <X size={14} aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                    {fotos.length < MAX_FOTOS && (
                        <label className="devolucao-foto-add" title="Escolher fotos">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                data-cy="devolucao-fotos-input"
                                onChange={(e) => {
                                    const lista = e.target.files;
                                    if (lista?.length) escolherFotos(lista);
                                    e.target.value = "";
                                }}
                            />
                            <Camera size={18} aria-hidden="true" />
                            <span>Adicionar</span>
                        </label>
                    )}
                </div>
                {erroFoto && <small className="fin-erro" role="alert">{erroFoto}</small>}
            </div>

            {escolhidos.length > 0 && (
                <p className="devolucao-total" data-cy="devolucao-total">
                    Reembolso previsto: <strong>{formatarReal(valor)}</strong>
                </p>
            )}

            {erro && <p className="fin-erro" role="alert" data-cy="devolucao-erro">{erro}</p>}

            <p className="devolucao-aviso">
                Não envie a peça ainda: depois da análise, mandamos por e-mail e aqui as instruções de envio. A peça deve voltar sem uso e com a etiqueta.
            </p>

            <div className="devolucao-acoes">
                <button type="button" className="pedido-ver-pecas" onClick={onFechar}>Voltar</button>
                <button type="submit" className="pedido-pagar" data-cy="enviar-devolucao" disabled={!podeEnviar}>
                    {enviando ? "Enviando…" : "Pedir devolução"}
                </button>
            </div>
        </form>
    );
}

// Bloco de devolução do pedido em "Meus pedidos".
export default function DevolucaoPedido({ pedido, devolucoes, onAtualizar }) {
    const [opcoes, setOpcoes] = useState(null);
    const [abrindo, setAbrindo] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [cancelando, setCancelando] = useState(null);
    const [enviandoFoto, setEnviandoFoto] = useState(null);
    const [erro, setErro] = useState("");
    const [aviso, setAviso] = useState("");

    const emAndamento = devolucoes.some((d) => ["solicitada", "aprovada", "recebida"].includes(d.status));
    const podePedir = pedido.status === "entregue" && !emAndamento;

    async function abrir() {
        setErro("");
        setAviso("");
        setAbrindo(true);
        try {
            const dados = await chamar(`orders/${pedido.id_pedido}/devolucao/opcoes`);
            if (!dados.elegivel) {
                setAviso(dados.motivo_inelegivel);
                return;
            }
            setOpcoes(dados);
        } catch (e) {
            setAviso(e.message);
        } finally {
            setAbrindo(false);
        }
    }

    async function enviar(corpo, fotos = []) {
        setEnviando(true);
        setErro("");
        try {
            const criada = await chamar(`orders/${pedido.id_pedido}/devolucoes`, { method: "POST", body: JSON.stringify(corpo) });
            let falhas = 0;
            for (const foto of fotos) {
                try {
                    await chamar(`devolucao-fotos/${criada.id_devolucao}`, { method: "POST", body: JSON.stringify({ foto }) });
                } catch {
                    falhas += 1;
                }
            }
            setOpcoes(null);
            setAviso(
                falhas
                    ? `Pedido de devolução enviado, mas ${falhas} foto(s) não subiram. Você pode anexar de novo abaixo.`
                    : "Pedido de devolução enviado. Vamos responder por e-mail e aqui em Meus pedidos.",
            );
            await onAtualizar();
        } catch (e) {
            setErro(e.message);
        } finally {
            setEnviando(false);
        }
    }

    async function adicionarFoto(devolucao, arquivo) {
        setEnviandoFoto(devolucao.id_devolucao);
        setAviso("");
        try {
            const foto = await reduzirImagem(arquivo);
            await chamar(`devolucao-fotos/${devolucao.id_devolucao}`, { method: "POST", body: JSON.stringify({ foto }) });
            await onAtualizar();
        } catch (e) {
            setAviso(e.message);
        } finally {
            setEnviandoFoto(null);
        }
    }

    async function cancelar(devolucao) {
        if (!window.confirm("Cancelar este pedido de devolução?")) return;
        setCancelando(devolucao.id_devolucao);
        try {
            await chamar(`devolucoes/${devolucao.id_devolucao}/cancelar`, { method: "POST" });
            await onAtualizar();
        } catch (e) {
            setAviso(e.message);
        } finally {
            setCancelando(null);
        }
    }

    if (!podePedir && devolucoes.length === 0) return null;

    return (
        <section className="pedido-devolucao" aria-label={`Devolução do pedido ${pedido.id_pedido}`}>
            {devolucoes.map((d) => (
                <AcompanharDevolucao
                    key={d.id_devolucao}
                    devolucao={d}
                    onCancelar={cancelar}
                    cancelando={cancelando === d.id_devolucao}
                    onAdicionarFoto={adicionarFoto}
                    enviandoFoto={enviandoFoto === d.id_devolucao}
                />
            ))}

            {aviso && <p className="devolucao-aviso" role="status" data-cy="devolucao-aviso">{aviso}</p>}

            {opcoes ? (
                <FormularioDevolucao opcoes={opcoes} onEnviar={enviar} onFechar={() => setOpcoes(null)} enviando={enviando} erro={erro} />
            ) : (
                podePedir && (
                    <button type="button" className="pedido-ver-pecas devolucao-abrir" data-cy="pedir-devolucao" onClick={abrir} disabled={abrindo}>
                        <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
                        {abrindo ? "Carregando…" : "Devolver peças"}
                    </button>
                )
            )}
        </section>
    );
}
