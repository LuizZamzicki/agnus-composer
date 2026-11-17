import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Plus, Tag } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import "../../css/cliente/finalizar.css";
import { apiUrl, assetUrl, authHeaders } from "../../utils/api";
import { EsqueletoLinhas } from "../../components/esqueleto";
import BarraFreteGratis from "../../components/barraFreteGratis";
import { FRETE_GRATIS_ACIMA } from "../../conteudo/loja";
import { esquecerCupomGuardado, lerCupomGuardado } from "../../utils/cupomGuardado";
import {
    SessaoExpirada,
    avisarSacola,
    encerrarSessao,
    formatarReal,
    listarItens,
    sessaoDeAdmin,
    sincronizarVisitante,
    usuarioDaSessao,
} from "../../utils/sacola";

const ENDERECO_VAZIO = {
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
};

const LOGIN = "/login?redirect=/finalizar";

function formatarCep(valor) {
    const digitos = String(valor || "").replace(/\D/g, "").slice(0, 8);

    return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

function camposFaltando(form) {
    const faltando = {};

    if (form.cep.replace(/\D/g, "").length !== 8) faltando.cep = "Informe os 8 números do CEP.";
    if (!form.logradouro.trim()) faltando.logradouro = "Informe a rua.";
    if (!form.numero.trim()) faltando.numero = "Informe o número.";
    if (!form.bairro.trim()) faltando.bairro = "Informe o bairro.";
    if (!form.cidade.trim()) faltando.cidade = "Informe a cidade.";
    if (form.estado.trim().length !== 2) faltando.estado = "Use a sigla, como SP.";

    return faltando;
}

function Campo({ nome, rotulo, form, erros, onChange, inputRef, className = "", ...props }) {
    return (
        <label className={`fin-campo ${className}`}>
            <span>{rotulo}</span>
            <input
                ref={inputRef}
                data-cy={nome}
                name={nome}
                value={form[nome]}
                onChange={onChange}
                aria-invalid={Boolean(erros[nome])}
                {...props}
            />
            {erros[nome] && <small className="fin-campo-erro">{erros[nome]}</small>}
        </label>
    );
}

function Finalizar() {
    const navigate = useNavigate();
    const idUsuario = usuarioDaSessao();
    const isAdmin = sessaoDeAdmin();
    const numeroRef = useRef(null);

    const [itens, setItens] = useState([]);
    const [enderecos, setEnderecos] = useState([]);
    const [enderecoId, setEnderecoId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mostrarForm, setMostrarForm] = useState(false);
    const [form, setForm] = useState(ENDERECO_VAZIO);
    const [erros, setErros] = useState({});
    const [salvandoEndereco, setSalvandoEndereco] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState("");
    const [cupom, setCupom] = useState(null);
    const [codigoCupom, setCodigoCupom] = useState(() => lerCupomGuardado());
    const [erroCupom, setErroCupom] = useState("");
    const [conferindoCupom, setConferindoCupom] = useState(false);

    async function aplicarCupom(evento) {
        evento?.preventDefault();
        const codigo = codigoCupom.trim();
        setErroCupom("");

        if (!codigo) {
            setErroCupom("Digite o código do cupom.");
            return;
        }

        setConferindoCupom(true);
        try {
            const res = await fetch(apiUrl(`cupons/${encodeURIComponent(codigo)}`), { headers: authHeaders() });
            const dados = await res.json().catch(() => ({}));

            if (res.status === 401) {
                encerrarSessao();
                navigate(LOGIN, { replace: true });
                return;
            }

            if (!res.ok) {
                setCupom(null);
                setErroCupom(dados.message || "Cupom inválido.");
                return;
            }

            setCupom(dados);
            setCodigoCupom(dados.codigo);
        } catch {
            setErroCupom("Sem conexão com o servidor. Tente de novo.");
        } finally {
            setConferindoCupom(false);
        }
    }

    useEffect(() => {
        if (!idUsuario || isAdmin) {
            return;
        }

        async function carregar() {
            try {
                await sincronizarVisitante(idUsuario);

                const [lista, resEnderecos] = await Promise.all([
                    listarItens(idUsuario),
                    fetch(apiUrl(`user-addresses/${idUsuario}`), { headers: authHeaders() }),
                ]);

                if (resEnderecos.status === 401) {
                    throw new SessaoExpirada();
                }

                const dados = resEnderecos.ok ? await resEnderecos.json() : [];
                const salvos = Array.isArray(dados) ? dados : [];
                const padrao = salvos.find((e) => e.principal) || salvos[0];

                setItens(lista);
                setEnderecos(salvos);
                setEnderecoId(padrao?.id_usuario_endereco ?? null);
                setMostrarForm(salvos.length === 0);
            } catch (error) {
                if (error instanceof SessaoExpirada) {
                    encerrarSessao();
                    navigate(LOGIN, { replace: true });
                    return;
                }

                setErro("Não foi possível carregar seus dados. Recarregue a página para tentar de novo.");
            } finally {
                setLoading(false);
            }
        }

        carregar();
    }, [idUsuario, isAdmin, navigate]);

    function alterarCampo(e) {
        const { name, value } = e.target;

        setForm((atual) => ({ ...atual, [name]: value }));
        setErros((atual) => ({ ...atual, [name]: undefined }));
    }

    // Preenche o endereço a partir do CEP; se o serviço falhar, o cliente digita normalmente.
    async function alterarCep(e) {
        const cep = formatarCep(e.target.value);

        setForm((atual) => ({ ...atual, cep }));
        setErros((atual) => ({ ...atual, cep: undefined }));

        const digitos = cep.replace(/\D/g, "");

        if (digitos.length !== 8) {
            return;
        }

        try {
            const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
            const dados = await res.json();

            if (dados.erro) {
                return;
            }

            setForm((atual) => ({
                ...atual,
                logradouro: dados.logradouro || atual.logradouro,
                bairro: dados.bairro || atual.bairro,
                cidade: dados.localidade || atual.cidade,
                estado: dados.uf || atual.estado,
            }));
            setErros((atual) => ({
                ...atual,
                logradouro: dados.logradouro ? undefined : atual.logradouro,
                bairro: dados.bairro ? undefined : atual.bairro,
                cidade: dados.localidade ? undefined : atual.cidade,
                estado: dados.uf ? undefined : atual.estado,
            }));
            numeroRef.current?.focus();
        } catch {
            // Sem preenchimento automático: os campos continuam editáveis.
        }
    }

    // Grava o endereço digitado e devolve o id para o pedido seguir sem novo clique.
    async function salvarEndereco() {
        const faltando = camposFaltando(form);

        setErros(faltando);

        if (Object.keys(faltando).length) {
            return null;
        }

        setSalvandoEndereco(true);

        try {
            const res = await fetch(apiUrl("user-addresses"), {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    ...form,
                    cep: form.cep.replace(/\D/g, ""),
                    estado: form.estado.trim().toUpperCase(),
                    id_usuario: idUsuario,
                    principal: enderecos.length === 0,
                }),
            });

            if (res.status === 401) {
                encerrarSessao();
                navigate(LOGIN, { replace: true });
                return null;
            }

            if (!res.ok) {
                setErro("Não foi possível salvar o endereço. Confira os dados e tente de novo.");
                return null;
            }

            const novo = await res.json();

            setEnderecos((atuais) => [...atuais, novo]);
            setEnderecoId(novo.id_usuario_endereco);
            setMostrarForm(false);
            setForm(ENDERECO_VAZIO);

            return novo.id_usuario_endereco;
        } catch {
            setErro("Sem conexão com o servidor. Tente de novo.");
            return null;
        } finally {
            setSalvandoEndereco(false);
        }
    }

    async function confirmarPedido() {
        setErro("");
        setEnviando(true);

        try {
            const destino = mostrarForm ? await salvarEndereco() : enderecoId;

            if (!destino) {
                if (!mostrarForm) {
                    setErro("Escolha um endereço de entrega.");
                }
                return;
            }

            const res = await fetch(apiUrl("orders/checkout"), {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ id_usuario_endereco: destino, ...(cupom ? { cupom: cupom.codigo } : {}) }),
            });

            if (res.status === 401) {
                encerrarSessao();
                navigate(LOGIN, { replace: true });
                return;
            }

            const dados = await res.json().catch(() => ({}));

            if (!res.ok) {
                setErro(dados.message || "Não foi possível concluir o pedido. Sua sacola continua guardada.");
                return;
            }

            avisarSacola();
            if (cupom) esquecerCupomGuardado();
            // O pedido nasce aguardando pagamento; o próximo passo é pagar (PIX ou cartão).
            navigate(`/pagamento/${dados.id_pedido}`, { replace: true });
        } catch {
            setErro("Sem conexão com o servidor. Sua sacola continua guardada, tente de novo.");
        } finally {
            setEnviando(false);
        }
    }

    if (!idUsuario) {
        return <Navigate to={LOGIN} replace />;
    }

    if (isAdmin) {
        return <Navigate to="/carrinho" replace />;
    }

    if (loading) {
        return (
            <div className="fin-page">
                <EsqueletoLinhas rotulo="Preparando o seu pedido…" />
            </div>
        );
    }

    if (!erro && itens.length === 0) {
        return <Navigate to="/carrinho" replace />;
    }

    const subtotal = itens.reduce(
        (acc, item) => acc + Number(item.preco_unitario || 0) * Number(item.quantidade || 0),
        0
    );
    const desconto = cupom ? Math.round(subtotal * cupom.percentual) / 100 : 0;
    const total = Math.round((subtotal - desconto) * 100) / 100;
    const freteGratis = total >= FRETE_GRATIS_ACIMA;

    return (
        <div className="fin-page">
            <Link to="/carrinho" className="back-link">
                <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /> Voltar à sacola
            </Link>

            <h1>Finalizar pedido</h1>

            <div className="fin-grade">
                <section className="fin-entrega" aria-labelledby="fin-entrega-titulo">
                    <h2 id="fin-entrega-titulo">Onde entregar?</h2>

                    {enderecos.length > 0 && (
                        <div className="fin-enderecos" role="radiogroup" aria-label="Endereço de entrega">
                            {enderecos.map((e) => (
                                <label
                                    key={e.id_usuario_endereco}
                                    className={`fin-endereco ${!mostrarForm && enderecoId === e.id_usuario_endereco ? "ativo" : ""}`}
                                >
                                    <input
                                        data-cy={`endereco-${e.id_usuario_endereco}`}
                                        type="radio"
                                        name="endereco"
                                        checked={!mostrarForm && enderecoId === e.id_usuario_endereco}
                                        onChange={() => {
                                            setEnderecoId(e.id_usuario_endereco);
                                            setMostrarForm(false);
                                        }}
                                    />
                                    <span>
                                        <strong>{e.logradouro}, {e.numero}</strong>
                                        {e.complemento && ` • ${e.complemento}`}
                                        <br />
                                        {e.bairro}, {e.cidade} - {e.estado}, CEP {formatarCep(e.cep)}
                                    </span>
                                </label>
                            ))}

                            {!mostrarForm && (
                                <button
                                    type="button"
                                    data-cy="outro-endereco"
                                    className="fin-outro"
                                    onClick={() => setMostrarForm(true)}
                                >
                                    <Plus size={16} strokeWidth={1.5} aria-hidden="true" /> Entregar em outro endereço
                                </button>
                            )}
                        </div>
                    )}

                    {mostrarForm && (
                        <div className="fin-form">
                            <Campo
                                nome="cep" rotulo="CEP" form={form} erros={erros} onChange={alterarCep}
                                inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" className="fin-cep"
                            />
                            <Campo nome="logradouro" rotulo="Rua" form={form} erros={erros} onChange={alterarCampo} autoComplete="address-line1" className="fin-larga" />
                            <Campo nome="numero" rotulo="Número" form={form} erros={erros} onChange={alterarCampo} inputRef={numeroRef} inputMode="numeric" />
                            <Campo nome="complemento" rotulo="Complemento (opcional)" form={form} erros={erros} onChange={alterarCampo} autoComplete="address-line2" />
                            <Campo nome="bairro" rotulo="Bairro" form={form} erros={erros} onChange={alterarCampo} className="fin-larga" />
                            <Campo nome="cidade" rotulo="Cidade" form={form} erros={erros} onChange={alterarCampo} autoComplete="address-level2" />
                            <Campo nome="estado" rotulo="Estado" form={form} erros={erros} onChange={alterarCampo} autoComplete="address-level1" maxLength={2} placeholder="SP" />

                            {enderecos.length > 0 && (
                                <button type="button" data-cy="cancelar-endereco" className="fin-outro fin-larga" onClick={() => { setMostrarForm(false); setErros({}); }}>
                                    Usar um endereço salvo
                                </button>
                            )}
                        </div>
                    )}
                </section>

                <aside className="fin-resumo" aria-labelledby="fin-resumo-titulo">
                    <h2 id="fin-resumo-titulo">Seu pedido</h2>

                    <ul>
                        {itens.map((item) => (
                            <li key={item.id_carrinho_item}>
                                {item.foto_produto && <img src={assetUrl(item.foto_produto)} alt="" />}
                                <span>
                                    {item.produto?.nome || "Produto"}
                                    <small>{item.cor?.nome} • Tam: {item.grade?.nome} • Qtd: {item.quantidade}</small>
                                </span>
                                <span className="fin-preco">{formatarReal(Number(item.preco_unitario) * Number(item.quantidade))}</span>
                            </li>
                        ))}
                    </ul>

                    <form className="fin-cupom" onSubmit={aplicarCupom} data-cy="form-cupom">
                        <label htmlFor="fin-cupom-codigo">Cupom de desconto</label>
                        {cupom ? (
                            <p className="fin-cupom-ok" data-cy="cupom-aplicado">
                                <Tag size={16} strokeWidth={1.5} aria-hidden="true" />
                                <span><strong>{cupom.codigo}</strong> · {cupom.percentual}% nas peças</span>
                                <button type="button" onClick={() => { setCupom(null); setErroCupom(""); }}>Remover</button>
                            </p>
                        ) : (
                            <div className="fin-cupom-campo">
                                <input
                                    id="fin-cupom-codigo"
                                    data-cy="cupom-codigo"
                                    value={codigoCupom}
                                    onChange={(e) => setCodigoCupom(e.target.value.toUpperCase())}
                                    placeholder="AGNUS10-XXXXXX"
                                    autoComplete="off"
                                    maxLength={40}
                                />
                                <button type="submit" data-cy="aplicar-cupom" className="btn-agnus-ghost" disabled={conferindoCupom}>
                                    {conferindoCupom ? "Conferindo…" : "Aplicar"}
                                </button>
                            </div>
                        )}
                        {erroCupom && <small className="fin-erro" role="alert" data-cy="cupom-erro">{erroCupom}</small>}
                    </form>

                    <div className="fin-linha"><span>Peças</span><span>{formatarReal(subtotal)}</span></div>
                    {cupom && (
                        <div className="fin-linha fin-desconto" data-cy="finalizar-desconto"><span>Desconto ({cupom.percentual}%)</span><span>− {formatarReal(desconto)}</span></div>
                    )}
                    <div className="fin-linha"><span>Frete</span><span data-cy="finalizar-frete">{freteGratis ? "Grátis" : "combinado depois"}</span></div>
                    <div className="fin-linha fin-total"><strong>Total</strong><strong data-cy="finalizar-total">{formatarReal(total)}</strong></div>
                    <BarraFreteGratis valor={total} />

                    {erro && <p data-cy="finalizar-erro" className="fin-erro" role="alert">{erro}</p>}

                    <button
                        type="button"
                        data-cy="confirmar-pedido"
                        className="btn-agnus fin-confirmar"
                        disabled={enviando || salvandoEndereco}
                        onClick={confirmarPedido}
                    >
                        <Check size={18} strokeWidth={1.5} aria-hidden="true" />
                        {enviando ? "Enviando…" : "Confirmar pedido"}
                    </button>

                    <p className="fin-aviso">
                        Depois de confirmar, você paga os produtos com PIX ou cartão (até 12x), sem sair do site.
                        {freteGratis ? " O frete deste pedido é por nossa conta." : " O frete é combinado com a gente depois."}
                    </p>
                </aside>
            </div>
        </div>
    );
}

export default Finalizar;
