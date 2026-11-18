import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ruler, X } from "lucide-react";
import "../css/cliente/guiaMedidas.css";

// ---------------------------------------------------------------------------------------------
// Desenhos das peças (viewBox 240x240). Cada medida tem a linha que mostra onde medir e a letra.
// As chaves batem com as colunas da tabela (largura, comprimento, manga, cava, cintura, quadril).
// ---------------------------------------------------------------------------------------------
const DESENHOS = {
    camiseta: {
        contorno: "M80 40 Q120 64 160 40 L205 62 L190 100 L165 86 L165 212 L75 212 L75 86 L50 100 L35 62 Z",
        medidas: {
            largura: { linha: [75, 112, 165, 112], letra: [120, 104] },
            comprimento: { linha: [146, 47, 146, 212], letra: [136, 160] },
            manga: { linha: [163, 46, 199, 70], letra: [190, 50] },
        },
    },
    regata: {
        contorno: "M90 30 L104 30 Q120 62 136 30 L150 30 Q152 72 168 94 L168 212 L72 212 L72 94 Q88 72 90 30 Z",
        medidas: {
            largura: { linha: [72, 124, 168, 124], letra: [120, 116] },
            comprimento: { linha: [143, 33, 143, 212], letra: [133, 170] },
            cava: { linha: [180, 30, 180, 94], letra: [192, 64] },
        },
    },
    short: {
        contorno: "M60 40 L180 40 L188 200 L130 205 L120 118 L110 205 L52 200 Z",
        medidas: {
            cintura: { linha: [60, 50, 180, 50], letra: [120, 66] },
            quadril: { linha: [57, 100, 183, 100], letra: [92, 92] },
            comprimento: { linha: [198, 40, 198, 200], letra: [210, 122] },
        },
    },
};

const desenhoDo = (modelo) => (modelo === "regata" ? DESENHOS.regata : modelo === "short" ? DESENHOS.short : DESENHOS.camiseta);

const LETRAS = ["A", "B", "C", "D", "E", "F"];

// Folga mínima entre o contorno da peça e o corpo, por caimento (cm).
const FOLGA = { babylook: 2, camiseta: 6, regata: 6, oversized: 14, short: 4 };

// Medida do corpo usada para sugerir o tamanho: tórax nas blusas, quadril no short.
const MEDIDA_DO_CORPO = {
    short: { chave: "quadril", rotulo: "quadril", dica: "Passe a fita na parte mais larga do quadril, sem apertar." },
    padrao: { chave: "largura", rotulo: "tórax", dica: "Passe a fita em volta do peito, na altura das axilas, sem apertar." },
};

function sugerirTamanho(tabela, corpoCm) {
    const regra = tabela.modelo === "short" ? MEDIDA_DO_CORPO.short : MEDIDA_DO_CORPO.padrao;
    const folga = FOLGA[tabela.modelo] ?? 6;

    // A tabela traz a medida da peça esticada (metade da volta): a volta inteira é o dobro.
    const opcoes = tabela.linhas
        .map((l) => ({ tamanho: l.tamanho, contorno: Number(l.valores[regra.chave]) * 2 }))
        .filter((o) => Number.isFinite(o.contorno))
        .sort((a, b) => a.contorno - b.contorno);

    if (opcoes.length === 0) return null;
    const escolhida = opcoes.find((o) => o.contorno - corpoCm >= folga);
    if (!escolhida) return { maior: opcoes[opcoes.length - 1], folga };
    return { ...escolhida, sobra: Math.round(escolhida.contorno - corpoCm), folga };
}

function DesenhoPeca({ tabela, ativa, onAtivar }) {
    const desenho = desenhoDo(tabela.modelo);

    return (
        <svg viewBox="0 0 240 240" className="medidas-desenho" role="img" aria-label="Desenho da peça mostrando onde cada medida é tirada">
            <path d={desenho.contorno} className="medidas-contorno" />
            {tabela.colunas.map((coluna, i) => {
                const medida = desenho.medidas[coluna.chave];
                if (!medida) return null;
                const [x1, y1, x2, y2] = medida.linha;
                const [lx, ly] = medida.letra;
                const classe = `medidas-marca ${ativa === coluna.chave ? "ativa" : ""} ${ativa && ativa !== coluna.chave ? "apagada" : ""}`;
                return (
                    <g key={coluna.chave} className={classe} onMouseEnter={() => onAtivar(coluna.chave)} onMouseLeave={() => onAtivar(null)}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} markerStart="url(#seta)" markerEnd="url(#seta)" />
                        <circle cx={lx} cy={ly} r="9" />
                        <text x={lx} y={ly + 4} textAnchor="middle">{LETRAS[i]}</text>
                    </g>
                );
            })}
            <defs>
                <marker id="seta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M0 0 L10 5 L0 10 z" className="medidas-seta" />
                </marker>
            </defs>
        </svg>
    );
}

function Calculadora({ tabela }) {
    const regra = tabela.modelo === "short" ? MEDIDA_DO_CORPO.short : MEDIDA_DO_CORPO.padrao;
    const temMedida = tabela.colunas.some((c) => c.chave === regra.chave);
    const [valor, setValor] = useState("");

    if (!temMedida) return null;

    const corpo = Number(String(valor).replace(",", "."));
    const sugestao = corpo >= 40 && corpo <= 200 ? sugerirTamanho(tabela, corpo) : null;

    return (
        <section className="medidas-bloco" aria-labelledby="medidas-calc">
            <h3 id="medidas-calc">Descubra seu tamanho</h3>
            <p className="medidas-texto">{regra.dica}</p>
            <label className="medidas-calc-campo">
                <span>Meu {regra.rotulo} tem</span>
                <input
                    type="number"
                    inputMode="decimal"
                    min="40"
                    max="200"
                    placeholder="ex.: 96"
                    value={valor}
                    data-cy="medidas-calculadora"
                    onChange={(e) => setValor(e.target.value)}
                    aria-describedby="medidas-sugestao"
                />
                <span>cm</span>
            </label>
            <p id="medidas-sugestao" className="medidas-sugestao" aria-live="polite" data-cy="medidas-sugestao">
                {sugestao?.tamanho && (
                    <>
                        Sugerimos o <strong>{sugestao.tamanho}</strong>: a peça tem {Math.round(sugestao.contorno)} cm de volta,
                        uma folga de {sugestao.sobra} cm no seu {regra.rotulo}.
                        {tabela.modelo === "oversized" && " Por ser oversized, a folga é grande de propósito."}
                    </>
                )}
                {sugestao?.maior && (
                    <>Nosso maior tamanho ({sugestao.maior.tamanho}) pode ficar justo para você. Fale com a gente antes de comprar.</>
                )}
            </p>
        </section>
    );
}

// Janela "Ver medidas": desenho, tabela (com o tamanho escolhido em destaque), como medir e sugestão.
export function JanelaMedidas({ tabela, nomeProduto, tamanhoSelecionado, onFechar }) {
    const [ativa, setAtiva] = useState(null);
    const fechar = useRef(null);

    useEffect(() => {
        const anterior = document.activeElement;
        fechar.current?.focus();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const aoTeclar = (e) => e.key === "Escape" && onFechar();
        document.addEventListener("keydown", aoTeclar);

        return () => {
            document.body.style.overflow = overflow;
            document.removeEventListener("keydown", aoTeclar);
            anterior?.focus?.();
        };
    }, [onFechar]);

    const letraDe = useMemo(() => Object.fromEntries(tabela.colunas.map((c, i) => [c.chave, LETRAS[i]])), [tabela]);
    const ehShort = tabela.modelo === "short";

    return (
        <div className="medidas-fundo" role="presentation" onClick={onFechar}>
            <div
                className="medidas-janela"
                role="dialog"
                aria-modal="true"
                aria-labelledby="medidas-titulo"
                data-cy="janela-medidas"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="medidas-topo">
                    <div>
                        <small>Guia de medidas</small>
                        <h2 id="medidas-titulo">{nomeProduto}</h2>
                    </div>
                    <button ref={fechar} type="button" className="medidas-fechar" onClick={onFechar} aria-label="Fechar guia de medidas" data-cy="fechar-medidas">
                        <X size={20} aria-hidden="true" />
                    </button>
                </header>

                <div className="medidas-conteudo">
                    <div className="medidas-grade">
                        <figure className="medidas-figura">
                            <DesenhoPeca tabela={tabela} ativa={ativa} onAtivar={setAtiva} />
                            <figcaption>Medidas da peça esticada sobre uma mesa, em centímetros.</figcaption>
                        </figure>

                        <ul className="medidas-legenda">
                            {tabela.colunas.map((c) => (
                                <li
                                    key={c.chave}
                                    className={ativa === c.chave ? "ativa" : ""}
                                    onMouseEnter={() => setAtiva(c.chave)}
                                    onMouseLeave={() => setAtiva(null)}
                                    onFocus={() => setAtiva(c.chave)}
                                    onBlur={() => setAtiva(null)}
                                    tabIndex={0}
                                >
                                    <span className="medidas-letra">{letraDe[c.chave]}</span>
                                    <span>
                                        <strong>{c.rotulo}</strong>
                                        {c.descricao && <small>{c.descricao}</small>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="medidas-tabela-rolagem">
                        <table className="medidas-tabela" data-cy="tabela-medidas">
                            <caption className="visualmente-oculto">Medidas por tamanho, em centímetros</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Tamanho</th>
                                    {tabela.colunas.map((c) => (
                                        <th
                                            scope="col"
                                            key={c.chave}
                                            className={ativa === c.chave ? "ativa" : ""}
                                            onMouseEnter={() => setAtiva(c.chave)}
                                            onMouseLeave={() => setAtiva(null)}
                                        >
                                            <span className="medidas-letra">{letraDe[c.chave]}</span> {c.rotulo}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {tabela.linhas.map((l) => {
                                    const escolhido = tamanhoSelecionado && l.tamanho.toUpperCase() === String(tamanhoSelecionado).toUpperCase();
                                    return (
                                        <tr key={l.tamanho} className={escolhido ? "escolhido" : ""} aria-current={escolhido ? "true" : undefined}>
                                            <th scope="row">
                                                {l.tamanho}
                                                {escolhido && <small>seu tamanho</small>}
                                            </th>
                                            {tabela.colunas.map((c) => (
                                                <td key={c.chave} className={ativa === c.chave ? "ativa" : ""}>
                                                    {String(l.valores[c.chave]).replace(".", ",")}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <Calculadora tabela={tabela} />

                    <section className="medidas-bloco" aria-labelledby="medidas-como">
                        <h3 id="medidas-como">Como medir</h3>
                        <ol className="medidas-passos">
                            <li>Pegue {ehShort ? "um short parecido" : "uma peça parecida"} que você usa e de que gosta do caimento.</li>
                            <li>Estique sobre uma mesa, sem puxar o tecido.</li>
                            <li>
                                Meça com uma fita métrica, seguindo as letras do desenho
                                {ehShort ? " (a cintura com o elástico solto)" : " (a largura de uma axila à outra)"}.
                            </li>
                            <li>Compare com a tabela: escolha o tamanho com as medidas mais próximas.</li>
                        </ol>
                    </section>

                    <aside className="medidas-aviso">
                        {tabela.observacao && <p>{tabela.observacao}</p>}
                        <p>As medidas podem variar até 2 cm, porque cada peça é produzida sob demanda.</p>
                        <p>
                            Não serviu? Você pode devolver em até 7 dias depois de receber. Dúvidas:{" "}
                            <a href="mailto:contato@agnusfit.com">contato@agnusfit.com</a>.
                        </p>
                    </aside>
                </div>
            </div>
        </div>
    );
}

// Botão "Ver medidas" (some quando o produto não tem tabela). variante "link" = texto ao lado de "Tamanho".
export default function VerMedidas({ tabela, nomeProduto, tamanhoSelecionado, variante = "botao" }) {
    const [aberta, setAberta] = useState(false);
    // Estável: a janela usa no efeito de foco/teclado; uma função nova a cada render tiraria o foco.
    const fechar = useCallback(() => setAberta(false), []);

    if (!tabela?.linhas?.length) return null;

    return (
        <>
            <button
                type="button"
                className={variante === "link" ? "medidas-link" : "btn-agnus-ghost medidas-botao"}
                onClick={() => setAberta(true)}
                data-cy={variante === "link" ? "ver-medidas-link" : "ver-medidas"}
                aria-haspopup="dialog"
            >
                <Ruler size={variante === "link" ? 15 : 18} strokeWidth={1.5} aria-hidden="true" />
                Ver medidas
            </button>
            {aberta && (
                <JanelaMedidas tabela={tabela} nomeProduto={nomeProduto} tamanhoSelecionado={tamanhoSelecionado} onFechar={fechar} />
            )}
        </>
    );
}
