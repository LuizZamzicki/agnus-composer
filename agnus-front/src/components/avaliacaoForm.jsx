import { X, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiUrl, assetUrl, authHeaders } from "../utils/api";

const MAX_FOTOS = 4;

export function Estrelas({ nota = 0, onEscolher = null }) {
    const valor = Number(nota) || 0;

    return (
        <div className="rating">
            {[1, 2, 3, 4, 5].map((n) => {
                const estrela = <Star size={18} className={n <= Math.round(valor) ? "star filled" : "star"} aria-hidden="true" />;

                return onEscolher ? (
                    <button
                        key={n}
                        type="button"
                        data-cy={`estrela-${n}`}
                        className="estrela-botao"
                        aria-label={`${n} de 5 estrelas`}
                        aria-pressed={n === valor}
                        onClick={() => onEscolher(n)}
                    >
                        {estrela}
                    </button>
                ) : (
                    <span key={n}>{estrela}</span>
                );
            })}
        </div>
    );
}

function nomeDaSessao() {
    try {
        const auth = JSON.parse(localStorage.getItem("auth") || "{}");
        return auth?.user?.nome || auth?.nome || "";
    } catch {
        return "";
    }
}

async function lerErro(res, padrao) {
    const dados = await res.json().catch(() => ({}));
    return dados.message || padrao;
}

// Cria a avaliação ou altera a que o cliente já fez: cada cliente tem uma por peça.
function AvaliacaoForm({ idProduto, idUsuario, avaliacao = null, onConcluir, onCancelar, onAviso }) {
    const emEdicao = Boolean(avaliacao);
    const idAvaliacao = avaliacao?.id_avaliacao_produto;

    const [nota, setNota] = useState(Number(avaliacao?.nota) || 0);
    const [nome, setNome] = useState(avaliacao?.titulo || "");
    const [comentario, setComentario] = useState(avaliacao?.comentario || "");
    const [fotosSalvas, setFotosSalvas] = useState([]);
    const [fotosRemovidas, setFotosRemovidas] = useState([]);
    const [fotosNovas, setFotosNovas] = useState([]);
    const [enviando, setEnviando] = useState(false);
    const [avisoLocal, setAvisoLocal] = useState(null);

    const avisar = onAviso ?? setAvisoLocal;
    const fotosMantidas = fotosSalvas.filter((foto) => !fotosRemovidas.includes(foto.id_avaliacao_foto));
    const vagasDeFoto = MAX_FOTOS - fotosMantidas.length - fotosNovas.length;
    const previas = useMemo(() => fotosNovas.map((foto) => URL.createObjectURL(foto)), [fotosNovas]);

    useEffect(() => () => previas.forEach((url) => URL.revokeObjectURL(url)), [previas]);

    useEffect(() => {
        if (!idAvaliacao) return undefined;

        let ativo = true;

        fetch(apiUrl(`product-review-photos/${idAvaliacao}`))
            .then((res) => (res.ok ? res.json() : []))
            .then((dados) => {
                if (ativo) setFotosSalvas(Array.isArray(dados) ? dados : []);
            })
            .catch(() => {});

        return () => {
            ativo = false;
        };
    }, [idAvaliacao]);

    function escolherFotos(event) {
        const escolhidas = Array.from(event.target.files || []);

        setFotosNovas((atuais) => [...atuais, ...escolhidas.slice(0, vagasDeFoto)]);
        event.target.value = "";
    }

    async function salvarTexto() {
        const res = await fetch(apiUrl(emEdicao ? `product-reviews/${idAvaliacao}` : "product-reviews"), {
            method: emEdicao ? "PUT" : "POST",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({
                id_produto: idProduto,
                id_usuario: idUsuario,
                nota,
                nome: nome.trim() || nomeDaSessao() || "Cliente Agnus",
                comentario: comentario.trim(),
            }),
        });

        if (!res.ok) {
            throw new Error(await lerErro(res, "Não foi possível salvar a avaliação."));
        }

        const dados = await res.json();
        return dados.id_avaliacao_produto ?? idAvaliacao;
    }

    async function salvarFotos(id) {
        await Promise.all(
            fotosRemovidas.map((foto) =>
                fetch(apiUrl(`product-review-photos/${foto}`), { method: "DELETE", headers: authHeaders() })
            )
        );

        if (fotosNovas.length === 0) return;

        const formData = new FormData();
        formData.append("id_avaliacao_produto", id);
        fotosNovas.forEach((foto) => formData.append("files", foto));

        const res = await fetch(apiUrl("product-review-photos"), {
            method: "POST",
            headers: authHeaders(),
            body: formData,
        });

        if (!res.ok) {
            throw new Error(await lerErro(res, "A avaliação foi salva, mas as fotos não foram enviadas."));
        }
    }

    async function enviar() {
        if (!nota) {
            avisar({ tipo: "erro", mensagem: "Selecione uma nota" });
            return;
        }

        if (!comentario.trim()) {
            avisar({ tipo: "erro", mensagem: "Digite um comentário" });
            return;
        }

        setEnviando(true);

        try {
            await salvarFotos(await salvarTexto());
            onAviso?.({ tipo: "sucesso", mensagem: emEdicao ? "Avaliação alterada!" : "Avaliação enviada!" });
            onConcluir?.();
        } catch (err) {
            avisar({ tipo: "erro", mensagem: err.message });
        } finally {
            setEnviando(false);
        }
    }

    return (
        <div className="avaliacao-form" data-cy="form-avaliacao">
            <span>Nome</span>
            <input
                data-cy="nome-avaliacao"
                placeholder="Seu nome (opcional)"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
            />

            <span>Nota</span>
            <Estrelas nota={nota} onEscolher={setNota} />

            <textarea
                data-cy="comentario-avaliacao"
                placeholder="Comentário"
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
            />

            <div className="avaliacao-imagens">
                <span>Fotos (máx. {MAX_FOTOS})</span>

                <input
                    data-cy="foto-avaliacao"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={escolherFotos}
                    disabled={vagasDeFoto <= 0}
                />

                {(fotosMantidas.length > 0 || previas.length > 0) && (
                    <div className="preview-imagens">
                        {fotosMantidas.map((foto) => (
                            <div key={foto.id_avaliacao_foto} className="preview-foto">
                                <img src={assetUrl(foto.caminho_url)} alt="" />
                                <button
                                    type="button"
                                    aria-label="Remover foto"
                                    onClick={() => setFotosRemovidas((atuais) => [...atuais, foto.id_avaliacao_foto])}
                                >
                                    <X size={14} strokeWidth={1.5} aria-hidden="true" />
                                </button>
                            </div>
                        ))}

                        {previas.map((url, indice) => (
                            <div key={url} className="preview-foto">
                                <img src={url} alt="" />
                                <button
                                    type="button"
                                    aria-label="Remover foto"
                                    onClick={() => setFotosNovas((atuais) => atuais.filter((_, i) => i !== indice))}
                                >
                                    <X size={14} strokeWidth={1.5} aria-hidden="true" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {avisoLocal && <p className="opcao-aviso" role="alert">{avisoLocal.mensagem}</p>}

            <button data-cy="enviar-avaliacao" onClick={enviar} disabled={enviando}>
                {enviando ? "Salvando…" : emEdicao ? "Salvar alteração" : "Enviar avaliação"}
            </button>

            {onCancelar && (
                <button type="button" className="avaliacao-cancelar" onClick={onCancelar}>
                    Cancelar
                </button>
            )}
        </div>
    );
}

export default AvaliacaoForm;
