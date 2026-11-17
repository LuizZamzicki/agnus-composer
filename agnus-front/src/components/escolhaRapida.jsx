import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Plus, X } from "lucide-react";
import { apiUrl } from "../utils/api";
import { SessaoExpirada, adicionarItem, adicionarVisitante, avisarSacola, sessaoDeAdmin, usuarioDaSessao } from "../utils/sacola";
import "../css/cliente/conversao.css";

const lista = (dados) => (Array.isArray(dados) ? dados : Array.isArray(dados?.data) ? dados.data : []);

// "Escolher tamanho" direto no card: abre os tamanhos (e as cores, se houver mais de uma) por cima
// da foto e coloca a peça na sacola sem sair da vitrine.
export default function EscolhaRapida({ produto, imagem, onAdicionado }) {
    const [aberto, setAberto] = useState(false);
    const [opcoes, setOpcoes] = useState(null);
    const [cor, setCor] = useState(null);
    const [estado, setEstado] = useState({ tipo: "" });

    const carregar = async () => {
        setEstado({ tipo: "carregando" });
        try {
            const [rCores, rGrades] = await Promise.all([
                fetch(apiUrl(`product-colors/${produto.id_produto}`)),
                fetch(apiUrl(`product-grades/${produto.id_produto}`)),
            ]);
            const cores = rCores.ok ? lista(await rCores.json()) : [];
            const grades = rGrades.ok ? lista(await rGrades.json()) : [];
            setOpcoes({ cores, grades });
            if (cores.length === 1) setCor(cores[0]);
            setEstado({ tipo: cores.length && grades.length ? "" : "indisponivel" });
        } catch {
            setEstado({ tipo: "erro", texto: "Não foi possível carregar os tamanhos." });
        }
    };

    const abrir = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setAberto(true);
        if (!opcoes) carregar();
    };

    const fechar = () => {
        setAberto(false);
        if (estado.tipo === "ok" || estado.tipo === "erro") setEstado({ tipo: "" });
    };

    const adicionar = async (grade) => {
        if (sessaoDeAdmin()) {
            setEstado({ tipo: "erro", texto: "Contas de administrador não fazem compras." });
            return;
        }
        if (!cor) {
            setEstado({ tipo: "erro", texto: "Escolha a cor primeiro." });
            return;
        }

        const item = {
            id_produto: produto.id_produto,
            id_produto_cor: Number(cor.id_produto_cor),
            id_produto_grade: Number(grade.id_produto_grade),
            quantidade: 1,
            preco_unitario: Number(produto.preco_base ?? 0) + Number(cor.acrescimo || 0) + Number(grade.acrescimo || 0),
            nome_produto: produto.nome,
            nome_cor: cor.nome,
            nome_tamanho: grade.nome,
            img: imagem,
        };

        setEstado({ tipo: "adicionando" });
        try {
            const idSessao = usuarioDaSessao();
            if (idSessao) {
                await adicionarItem(idSessao, item);
                avisarSacola();
            } else {
                adicionarVisitante(item);
            }
            setEstado({ tipo: "ok", texto: `${grade.nome} · ${cor.nome}` });
            onAdicionado?.();
        } catch (err) {
            if (err instanceof SessaoExpirada) {
                adicionarVisitante(item);
                setEstado({ tipo: "ok", texto: `${grade.nome} · ${cor.nome}` });
                onAdicionado?.();
            } else {
                setEstado({ tipo: "erro", texto: "Não foi possível adicionar. Tente de novo." });
            }
        }
    };

    if (!aberto) {
        return (
            <div className="escolha-rapida">
                <button type="button" className="escolha-rapida-abrir" data-cy="escolha-rapida-abrir" onClick={abrir} aria-label={`Escolher tamanho de ${produto.nome}`}>
                    <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span>Escolher tamanho</span>
                </button>
            </div>
        );
    }

    const cores = opcoes?.cores ?? [];
    const grades = opcoes?.grades ?? [];

    return (
        <div className="escolha-rapida is-aberta">
            <div className="escolha-rapida-painel" data-cy="escolha-rapida" role="dialog" aria-label={`Escolher tamanho de ${produto.nome}`}>
                <div className="escolha-rapida-topo">
                    <span>{estado.tipo === "ok" ? "Na sacola" : cores.length > 1 && !cor ? "Cor e tamanho" : "Tamanho"}</span>
                    <button type="button" className="escolha-rapida-fechar" aria-label="Fechar" onClick={fechar}>
                        <X size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                </div>

                {estado.tipo === "carregando" && <p className="escolha-rapida-aviso">Carregando…</p>}
                {estado.tipo === "indisponivel" && <p className="escolha-rapida-aviso">Peça indisponível no momento.</p>}

                {estado.tipo === "ok" ? (
                    <div className="escolha-rapida-ok" data-cy="escolha-rapida-ok">
                        <p><Check size={16} strokeWidth={2} aria-hidden="true" /> {estado.texto}</p>
                        <Link to="/carrinho" className="escolha-rapida-sacola">Ver sacola</Link>
                    </div>
                ) : (
                    opcoes && estado.tipo !== "indisponivel" && (
                        <>
                            {cores.length > 1 && (
                                <div className="escolha-rapida-opcoes" role="group" aria-label="Cor">
                                    {cores.map((c) => (
                                        <button
                                            key={c.id_produto_cor}
                                            type="button"
                                            className={cor?.id_produto_cor === c.id_produto_cor ? "active" : ""}
                                            aria-pressed={cor?.id_produto_cor === c.id_produto_cor}
                                            onClick={() => {
                                                setCor(c);
                                                setEstado({ tipo: "" });
                                            }}
                                        >
                                            {c.nome}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="escolha-rapida-opcoes" role="group" aria-label="Tamanho">
                                {grades.map((g) => (
                                    <button
                                        key={g.id_produto_grade}
                                        type="button"
                                        data-cy="escolha-rapida-tamanho"
                                        disabled={estado.tipo === "adicionando"}
                                        onClick={() => adicionar(g)}
                                    >
                                        {g.nome}
                                    </button>
                                ))}
                            </div>
                        </>
                    )
                )}

                {estado.tipo === "erro" && <p className="escolha-rapida-aviso is-erro" role="alert">{estado.texto}</p>}
            </div>
        </div>
    );
}
