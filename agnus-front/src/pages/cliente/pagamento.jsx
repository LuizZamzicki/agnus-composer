import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Lock } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../../css/cliente/finalizar.css";
import { apiUrl, authHeaders } from "../../utils/api";
import { EsqueletoLinhas } from "../../components/esqueleto";
import { carregarSdkMercadoPago, motivoDaRecusa } from "../../utils/mercadoPago";
import { encerrarSessao, formatarReal } from "../../utils/sacola";
import { temaAtual } from "../../utils/tema";

const CONSULTA_MS = 5000;
const ID_DO_FORMULARIO = "pagamento-mercado-pago";

async function pedirJson(caminho, opcoes = {}) {
    const res = await fetch(apiUrl(caminho), {
        ...opcoes,
        headers: authHeaders({ "Content-Type": "application/json", ...(opcoes.headers || {}) }),
    });
    const dados = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, dados };
}

function Pix({ pix, onCopiar, copiado }) {
    return (
        <div className="pag-pix" data-cy="pix">
            <h2>Pague com PIX</h2>
            <p>Abra o app do seu banco, escolha pagar com PIX e leia o QR Code ou cole o código abaixo.</p>

            {pix.qr_code_base64 && (
                <img
                    className="pag-qr"
                    src={`data:image/png;base64,${pix.qr_code_base64}`}
                    alt="QR Code do PIX"
                    data-cy="pix-qr"
                />
            )}

            <label className="pag-copia">
                <span>PIX copia e cola</span>
                <textarea readOnly value={pix.copia_e_cola} data-cy="pix-copia-e-cola" rows={3} />
            </label>

            <button type="button" className="btn-agnus fin-confirmar" onClick={onCopiar} data-cy="pix-copiar">
                {copiado ? <><Check size={18} aria-hidden="true" /> Código copiado</> : <><Copy size={18} aria-hidden="true" /> Copiar código</>}
            </button>

            {pix.expira_em && (
                <p className="fin-aviso">
                    Válido até {new Date(pix.expira_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
                </p>
            )}
            <p className="fin-aviso" data-cy="pix-aguardando">Assim que o pagamento cair, esta página avisa sozinha.</p>
        </div>
    );
}

function Pagamento() {
    const { id } = useParams();
    const navigate = useNavigate();
    const controleDoFormulario = useRef(null);

    const [carregando, setCarregando] = useState(true);
    const [config, setConfig] = useState(null);
    const [total, setTotal] = useState(null);
    const [pix, setPix] = useState(null);
    const [emAnalise, setEmAnalise] = useState(false);
    const [erro, setErro] = useState("");
    const [erroFatal, setErroFatal] = useState("");
    const [copiado, setCopiado] = useState(false);

    const irParaConfirmacao = useCallback(
        () => navigate(`/pedido-confirmado/${id}`, { replace: true }),
        [id, navigate],
    );

    const tratarSessao = useCallback((status) => {
        if (status === 401) {
            encerrarSessao();
            navigate(`/login?redirect=/pagamento/${id}`, { replace: true });
            return true;
        }
        return false;
    }, [id, navigate]);

    // Situação do pedido e do último pagamento; usada também para acompanhar o PIX.
    const consultar = useCallback(async () => {
        const { ok, status, dados } = await pedirJson(`orders/${id}/pagamento`);

        if (tratarSessao(status)) return null;
        if (!ok) throw new Error(dados.message || "Não foi possível carregar o pedido.");

        if (dados.status_pedido === "pago") {
            irParaConfirmacao();
            return null;
        }

        return dados;
    }, [id, irParaConfirmacao, tratarSessao]);

    useEffect(() => {
        let ativo = true;

        async function iniciar() {
            try {
                const [situacao, configuracao] = await Promise.all([consultar(), pedirJson("pagamentos/config")]);
                if (!ativo || !situacao) return;

                if (situacao.status_pedido !== "aguardando_pagamento") {
                    setErroFatal("Este pedido não está aguardando pagamento.");
                    return;
                }

                setTotal(situacao.total);
                setConfig(configuracao.dados);

                if (situacao.pagamento?.pix && situacao.pagamento.status === "pending") {
                    setPix(situacao.pagamento.pix);
                } else if (["in_process", "pending"].includes(situacao.pagamento?.status)) {
                    setEmAnalise(true);
                }
            } catch (e) {
                if (ativo) setErroFatal(e.message || "Não foi possível carregar o pagamento.");
            } finally {
                if (ativo) setCarregando(false);
            }
        }

        iniciar();
        return () => {
            ativo = false;
        };
    }, [consultar]);

    // Enquanto o PIX ou o cartão estão em análise, pergunta de tempos em tempos se já foi pago.
    useEffect(() => {
        if (!pix && !emAnalise) return undefined;

        const timer = setInterval(() => {
            consultar().catch(() => {});
        }, CONSULTA_MS);

        return () => clearInterval(timer);
    }, [pix, emAnalise, consultar]);

    const enviar = useCallback(async ({ formData }) => {
        setErro("");
        const { ok, status, dados } = await pedirJson(`orders/${id}/pagamento`, {
            method: "POST",
            body: JSON.stringify(formData),
        });

        if (tratarSessao(status)) return;

        if (!ok) {
            setErro(dados.message || "Não foi possível pagar agora. Tente de novo.");
            throw new Error("pagamento recusado pela API");
        }

        if (dados.status_pedido === "pago" || dados.pagamento?.status === "approved") {
            irParaConfirmacao();
            return;
        }

        if (dados.pagamento?.pix) {
            setPix(dados.pagamento.pix);
            return;
        }

        if (["in_process", "pending"].includes(dados.pagamento?.status)) {
            setEmAnalise(true);
            return;
        }

        setErro(motivoDaRecusa(dados.pagamento?.status_detalhe));
        throw new Error("pagamento recusado");
    }, [id, irParaConfirmacao, tratarSessao]);

    // Formulário seguro do Mercado Pago (Payment Brick): PIX e cartão de crédito.
    useEffect(() => {
        if (!config?.ativo || !total || pix || emAnalise) return undefined;

        let desmontado = false;

        async function montar() {
            try {
                const MercadoPago = await carregarSdkMercadoPago();
                if (desmontado) return;

                const mp = new MercadoPago(config.publicKey, { locale: "pt-BR" });
                controleDoFormulario.current = await mp.bricks().create("payment", ID_DO_FORMULARIO, {
                    initialization: { amount: Number(total) },
                    customization: {
                        paymentMethods: { creditCard: "all", bankTransfer: ["pix"], maxInstallments: 12 },
                        visual: { style: { theme: temaAtual() === "dark" ? "dark" : "default" } },
                    },
                    callbacks: {
                        onReady: () => {},
                        onSubmit: enviar,
                        onError: () => setErro("O formulário de pagamento teve um problema. Recarregue a página."),
                    },
                });
            } catch {
                if (!desmontado) setErroFatal("Não foi possível abrir o pagamento agora. Recarregue a página em instantes.");
            }
        }

        montar();

        return () => {
            desmontado = true;
            controleDoFormulario.current?.unmount?.();
            controleDoFormulario.current = null;
        };
    }, [config, total, pix, emAnalise, enviar]);

    async function copiarPix() {
        try {
            await navigator.clipboard.writeText(pix.copia_e_cola);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 3000);
        } catch {
            setErro("Não foi possível copiar. Selecione o código e copie manualmente.");
        }
    }

    if (carregando) {
        return (
            <div className="fin-page">
                <EsqueletoLinhas rotulo="Carregando o pagamento…" />
            </div>
        );
    }

    if (erroFatal) {
        return (
            <div className="fin-page fin-confirmado" data-cy="pagamento-erro">
                <h1>Pagamento do pedido nº&nbsp;{id}</h1>
                <p className="fin-erro">{erroFatal}</p>
                <Link to="/cliente/pedidos" className="fin-link">Ver meus pedidos</Link>
            </div>
        );
    }

    if (!config?.ativo) {
        return (
            <div className="fin-page fin-confirmado" data-cy="pagamento-indisponivel">
                <h1>Pedido nº&nbsp;{id} recebido</h1>
                <p className="fin-valor">Total: {formatarReal(total)}</p>
                <div className="fin-proximo">
                    <h2>Pagamento pelo site indisponível</h2>
                    <p>O pagamento online ainda não está ativo. Fale com a gente informando o número do pedido.</p>
                </div>
                <Link to="/cliente/pedidos" className="fin-link">Ver meus pedidos</Link>
            </div>
        );
    }

    return (
        <div className="fin-page pag-page">
            <h1 data-cy="pagamento-titulo">Pagamento do pedido nº&nbsp;{id}</h1>
            <p className="fin-valor" data-cy="pagamento-total">Total: {formatarReal(total)}</p>

            {erro && <p className="fin-erro" role="alert" data-cy="pagamento-erro-msg">{erro}</p>}

            {pix && <Pix pix={pix} onCopiar={copiarPix} copiado={copiado} />}

            {emAnalise && !pix && (
                <div className="fin-proximo" data-cy="pagamento-em-analise">
                    <h2>Pagamento em análise</h2>
                    <p>O Mercado Pago está conferindo o pagamento. Esta página avisa assim que for aprovado; você também recebe a notificação no site.</p>
                </div>
            )}

            {!pix && !emAnalise && <div id={ID_DO_FORMULARIO} data-cy="pagamento-formulario" />}

            <p className="fin-aviso pag-seguro">
                <Lock size={16} aria-hidden="true" /> Pagamento processado pelo Mercado Pago. Os dados do cartão não passam pela Agnus.
            </p>
            <Link to="/cliente/pedidos" className="fin-link">Pagar depois (o pedido fica em Meus pedidos)</Link>
        </div>
    );
}

export default Pagamento;
